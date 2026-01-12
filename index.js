const login = require("fca-project-orion");
const fs = require("fs-extra");
const express = require("express");

const app = express();
const port = process.env.PORT || 8000;
app.get("/", (req, res) => res.send("Bot is Alive!"));
app.listen(port);

const ADMIN_ID = "7707686630"; 
const PAYMENT_NUMBER = "01704400069";

let regStatus = true;
let regMode = "free"; 
let confirmedTeams = [];
let allGroupsData = [];
let round2Teams = [];
let round3Teams = [];
let registeredIDs = new Set();
let tempRegData = {}; 

const loginConfig = { appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8')) };

login(loginConfig, (err, api) => {
    if(err) {
        console.error("লগইন এরর: আপনার appstate.json সম্ভবত এক্সপায়ার হয়েছে। নতুন কুকি দিন।");
        return;
    }

    api.setOptions({ listenEvents: true, selfListen: false, forceLogin: true });
    console.log("বট সফলভাবে মেসেঞ্জারে চালু হয়েছে!");

    api.listenMqtt((err, event) => {
        if(err) return;
        if (event.type !== "message") return;

        const senderID = event.senderID;
        const body = event.body ? event.body.trim() : "";
        const threadID = event.threadID;
        const groupLetter = String.fromCharCode(65 + allGroupsData.length);

        if (senderID === ADMIN_ID) {
            const cmd = body.toLowerCase();
            if (cmd === "/on") { regStatus = true; api.sendMessage("✅ রেজিস্ট্রেশন চালু।", threadID); return; }
            if (cmd === "/off") { regStatus = false; api.sendMessage("🛑 রেজিস্ট্রেশন বন্ধ।", threadID); return; }
            if (cmd === "/mode free") { regMode = "free"; api.sendMessage("✅ মোড: FREE", threadID); return; }
            if (cmd === "/mode paid") { regMode = "paid"; api.sendMessage("✅ মোড: PAID", threadID); return; }
            
            if (cmd.startsWith("win ")) {
                try {
                    let parts = cmd.split(" ");
                    let letter = parts[1].toUpperCase();
                    let slot = parseInt(parts[2]) - 1;
                    let idx = letter.charCodeAt(0) - 65;
                    let target = (idx === allGroupsData.length) ? confirmedTeams : allGroupsData[idx];
                    let winner = target[slot];
                    if (winner) {
                        round2Teams.push(winner);
                        api.sendMessage(`🎊 অভিনন্দন ${winner.name}! Round 2 কোয়ালিফাই করেছেন! 🏆`, winner.id);
                        api.sendMessage(`✅ ${winner.name} যুক্ত হয়েছে।`, ADMIN_ID);
                    }
                } catch(e) { api.sendMessage("❌ ভুল কমান্ড। উদা: Win A 5", threadID); }
                return;
            }
        }

        if (body.toLowerCase() === "/list") {
            let msg = `🏆 Group ${groupLetter} Status 🏆\n━━━━━━━━━━━━━━\n`;
            for (let i = 1; i <= 12; i++) {
                msg += i <= confirmedTeams.length ? `✅ Slot ${i}: ${confirmedTeams[i-1].name}\n` : `⬜ Slot ${i}: খালি\n`;
            }
            api.sendMessage(msg, threadID);
            return;
        }

        if (body.toLowerCase().startsWith("/reg ")) {
            if (!regStatus) return api.sendMessage("🛑 রেজিস্ট্রেশন বন্ধ।", threadID);
            if (registeredIDs.has(senderID)) return api.sendMessage("❌ অলরেডি করেছেন।", threadID);
            if (confirmedTeams.length >= 12) return api.sendMessage("🚫 স্লট পূর্ণ!", threadID);
            
            let teamName = body.slice(5).trim();
            tempRegData[senderID] = { id: senderID, name: teamName };
            
            if (regMode === "paid") {
                api.sendMessage(`💰 বিকাশ/নগদ: ${PAYMENT_NUMBER}\nটাকা পাঠিয়ে TxID দিন।`, threadID);
            } else {
                completeRegistration(senderID, threadID, api, groupLetter);
            }
            return;
        }

        if (regMode === "paid" && tempRegData[senderID] && !registeredIDs.has(senderID) && body.length > 5) {
            api.sendMessage(`🔔 পেমেন্ট চেক: ${tempRegData[senderID].name}\nTxID: ${body}`, ADMIN_ID);
            api.sendMessage("⏳ আপনার তথ্য পাঠানো হয়েছে। অ্যাডমিন চেক করছে।", threadID);
        }
    });
});

function completeRegistration(uid, tid, api, groupLetter) {
    let data = tempRegData[uid];
    if (!data) return;
    confirmedTeams.push(data);
    registeredIDs.add(uid);
    api.sendMessage(`✅ সফল! ${data.name}\nগ্রুপ: ${groupLetter}\nস্লট: ${confirmedTeams.length}/12`, tid);
    if (confirmedTeams.length === 12) {
        allGroupsData.push([...confirmedTeams]);
        confirmedTeams = [];
        api.sendMessage(`🔥 Group ${groupLetter} Full!`, ADMIN_ID);
    }
}
