const login = require("fca-unofficial");
const fs = require("fs");

// --- কনফিগারেশন ---
const ADMIN_ID = "7707686630"; // আপনার ফেসবুক ইউজার আইডি
const PAYMENT_NUMBER = "01704400069";

// ডাটাবেজ (মেমোরিতে)
let regStatus = true;
let regMode = "free"; 
let confirmedTeams = [];
let allGroupsData = [];
let round2Teams = [];
let round3Teams = [];
let registeredIDs = new Set();
let tempRegData = {}; // পেমেন্ট প্রুফের জন্য

login({appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))}, (err, api) => {
    if(err) return console.error(err);

    api.setOptions({listenEvents: true, selfListen: true});
    console.log("বট সফলভাবে ফেসবুক প্রোফাইলে চালু হয়েছে!");

    api.listenMqtt((err, event) => {
        if(err) return;
        if (event.type !== "message") return;

        const senderID = event.senderID;
        const body = event.body ? event.body.trim() : "";
        const threadID = event.threadID;

        // --- অ্যাডমিন কমান্ডস (শুধু আপনার ইনবক্সে) ---
        if (senderID === ADMIN_ID) {
            const cmd = body.toLowerCase();

            if (cmd === "/on") { regStatus = true; api.sendMessage("✅ রেজিস্ট্রেশন চালু করা হয়েছে।", threadID); return; }
            if (cmd === "/off") { regStatus = false; api.sendMessage("🛑 রেজিস্ট্রেশন বন্ধ করা হয়েছে।", threadID); return; }
            if (cmd === "/mode free") { regMode = "free"; api.sendMessage("✅ মোড: FREE", threadID); return; }
            if (cmd === "/mode paid") { regMode = "paid"; api.sendMessage("✅ মোড: PAID", threadID); return; }
            
            if (cmd === "/finish") {
                confirmedTeams = []; allGroupsData = []; round2Teams = []; round3Teams = []; registeredIDs = new Set();
                api.sendMessage("♻️ সব ডাটা মুছে ফেলা হয়েছে!", threadID); return;
            }

            // উইনার সিস্টেম (উদা: Group A Winning)
            if (cmd.includes("winning")) {
                let parts = cmd.split(" ");
                let letter = parts[1].toUpperCase();
                let idx = letter.charCodeAt(0) - 65;
                let target = (idx === allGroupsData.length) ? confirmedTeams : allGroupsData[idx];

                if (!target || target.length === 0) return api.sendMessage("❌ এই গ্রুপে কোনো ডাটা নেই।", threadID);

                let msg = `🏆 Group ${letter} থেকে উইনার বেছে নিতে নম্বর লিখে রিপ্লাই দিন:\n`;
                target.forEach((t, i) => msg += `${i + 1}. ${t.name}\n`);
                api.sendMessage(msg + "\n(উদা: Win A 5)", threadID);
                return;
            }

            // উইনার কনফার্ম করা (উদা: Win A 5)
            if (cmd.startsWith("win ")) {
                let parts = cmd.split(" ");
                let letter = parts[1].toUpperCase();
                let slot = parseInt(parts[2]) - 1;
                let idx = letter.charCodeAt(0) - 65;
                let target = (idx === allGroupsData.length) ? confirmedTeams : allGroupsData[idx];
                
                let winner = target[slot];
                if (winner) {
                    round2Teams.push(winner);
                    api.sendMessage(`🎊 অভিনন্দন ${winner.name}! আপনি Round 2 তে কোয়ালিফাই করেছেন! 🏆`, winner.id);
                    api.sendMessage(`✅ ${winner.name} রাউন্ড ২ তে যুক্ত হয়েছে।`, ADMIN_ID);
                }
                return;
            }
        }

        // --- ইউজার কমান্ডস ---
        if (body.toLowerCase() === "/list") {
            let grpName = String.fromCharCode(65 + allGroupsData.length);
            let msg = `🏆 Group ${grpName} Status 🏆\n━━━━━━━━━━━━━━\n`;
            for (let i = 1; i <= 12; i++) {
                msg += i <= confirmedTeams.length ? `✅ Slot ${i}: ${confirmedTeams[i-1].name}\n` : `⬜ Slot ${i}: খালি\n`;
            }
            api.sendMessage(msg, threadID);
            return;
        }

        if (body.toLowerCase().startsWith("/reg ")) {
            if (!regStatus) return api.sendMessage("🛑 রেজিস্ট্রেশন বন্ধ।", threadID);
            if (registeredIDs.has(senderID)) return api.sendMessage("❌ আপনি অলরেডি রেজিস্ট্রেশন করেছেন।", threadID);
            if (confirmedTeams.length >= 12) return api.sendMessage("🚫 স্লট পূর্ণ!", threadID);

            let teamName = body.slice(5);
            tempRegData[senderID] = { id: senderID, name: teamName };

            if (regMode === "paid") {
                let payMsg = `✨ পেমেন্ট ডিটেইলস ✨\n━━━━━━━━━━━━━━\n💰 বিকাশ/নগদ/রকেট: ${PAYMENT_NUMBER}\n\nটাকা পাঠিয়ে ট্রানজেকশন আইডি লিখে পাঠান।`;
                api.sendMessage(payMsg, threadID);
            } else {
                completeRegistration(senderID, threadID, api);
            }
            return;
        }

        // পেমেন্ট আইডি চেক (যদি পেইড মোড হয়)
        if (regMode === "paid" && tempRegData[senderID] && !registeredIDs.has(senderID)) {
            api.sendMessage(`🔔 নতুন পেমেন্ট অনুরোধ!\nটিম: ${tempRegData[senderID].name}\nTxID: ${body}\n\nঅ্যাডমিন চেক করছে...`, ADMIN_ID);
            api.sendMessage("⏳ আপনার তথ্য পাঠানো হয়েছে। অ্যাডমিন চেক করলে স্লটে নাম উঠবে।", threadID);
            // এখানে অ্যাডমিন ম্যানুয়ালি /app [UserID] লিখে কনফার্ম করতে পারবে (সহজ করার জন্য)
        }
    });
});

function completeRegistration(uid, tid, api) {
    let data = tempRegData[uid];
    confirmedTeams.push(data);
    registeredIDs.add(uid);
    let grpName = String.fromCharCode(65 + allGroupsData.length);
    api.sendMessage(`✅ রেজিস্ট্রেশন সফল!\nটিম: ${data.name}\nগ্রুপ: ${grpName}\nস্লট: ${confirmedTeams.length}/12`, tid);
    
    if (confirmedTeams.length === 12) {
        allGroupsData.push([...confirmedTeams]);
        confirmedTeams = [];
        api.sendMessage(`🔥 Group ${grpName} পূর্ণ হয়েছে!`, ADMIN_ID);
    }
        }
