import requests
import time
from telegram import Bot

# তোমার বট টোকেন এবং চ্যানেল আইডি
TELEGRAM_BOT_TOKEN = "7513820233:AAEVLpUVvJqT-CUSUmkusLCYLWKv0NyDzWI"
TELEGRAM_CHANNEL = "@BDT_HACEKR_RAFI"

bot = Bot(token=TELEGRAM_BOT_TOKEN)

history_data = []
last_prediction = None
last_period = None
consecutive_losses = 0

def fetch_game_result():
    try:
        url = "https://hgzy.pages.dev"
        response = requests.get(url)
        response.raise_for_status()
        html = response.text

        index = html.find("latestResult")
        start = html.find("{", index)
        end = html.find("}", start) + 1
        json_str = html[start:end].replace("'", '"')

        import json
        latest = json.loads(json_str)
        number = latest["number"]
        result_type = "BIG" if int(number) >= 50 else "SMALL"

        return {
            "period": latest["issueNumber"],
            "number": number,
            "result_type": result_type
        }

    except Exception as e:
        print("Error fetching result:", e)
        return None

def advanced_trend_analysis():
    global history_data, consecutive_losses, last_prediction

    if len(history_data) < 3:
        return "BIG"

    if consecutive_losses >= 2:
        return "SMALL" if last_prediction == "BIG" else "BIG"

    recent = history_data[-5:]
    alternating = all(
        (recent[i]["result_type"] == "BIG" and recent[i+1]["result_type"] == "SMALL") or
        (recent[i]["result_type"] == "SMALL" and recent[i+1]["result_type"] == "BIG")
        for i in range(len(recent)-1)
    )
    if alternating:
        return "SMALL" if recent[-1]["result_type"] == "BIG" else "BIG"

    streak_type = recent[0]["result_type"]
    streak = 1
    for i in range(1, len(recent)):
        if recent[i]["result_type"] == streak_type:
            streak += 1
        else:
            break
    if streak >= 3:
        return "SMALL" if streak_type == "BIG" else "BIG"

    bigs = sum(1 for r in recent if r["result_type"] == "BIG")
    smalls = sum(1 for r in recent if r["result_type"] == "SMALL")
    if bigs >= 4:
        return "SMALL"
    if smalls >= 4:
        return "BIG"

    last_two_same = recent[0]["result_type"] == recent[1]["result_type"]
    return "SMALL" if recent[0]["result_type"] == "BIG" else "BIG" if last_two_same else "BIG"

def send_prediction(prediction, period):
    msg = f"🎯 পর্বঃ {period}\nসিগনালঃ {prediction}"
    bot.send_message(chat_id=TELEGRAM_CHANNEL, text=msg)

def send_result(win, period, result, prediction):
    if win:
        msg = f"✅ মধু মামা মধু!!!\n\nপর্বঃ {period}\nসিগনালঃ {prediction}\nফলাফলঃ {result} ✅ WIN"
    else:
        msg = f"❌ আহারে... গেম দিল ধোঁকা!\n\nপর্বঃ {period}\nসিগনালঃ {prediction}\nফলাফলঃ {result} ❌ LOSS"
    bot.send_message(chat_id=TELEGRAM_CHANNEL, text=msg)

def run_bot():
    global history_data, last_prediction, last_period, consecutive_losses

    while True:
        result = fetch_game_result()
        if result and result["period"] != last_period:
            last_period = result["period"]
            prediction = advanced_trend_analysis()
            last_prediction = prediction

            current_period = str(int(result["period"]) + 1)
            send_prediction(prediction, current_period)

            if history_data and history_data[0]["period"] == result["period"]:
                last_result = history_data[0]
                win = last_result["prediction"] == result["result_type"]
                send_result(win, last_result["period"], result["result_type"], last_result["prediction"])
                consecutive_losses = 0 if win else consecutive_losses + 1

            history_data.insert(0, {
                "period": current_period,
                "prediction": prediction,
                "result_type": result["result_type"]
            })

        time.sleep(60)

if __name__ == "__main__":
    run_bot()
