"""
天气路由 - 接入 Open-Meteo 免费天气 API
无需 API Key，全球免费使用
"""
import httpx
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/weather", tags=["天气"])

# Open-Meteo: completely free, no API key required
BASE_URL = "https://api.open-meteo.com/v1/forecast"

CITY_COORDS = {
    "北京": (39.9042, 116.4074),
    "上海": (31.2304, 121.4737),
    "广州": (23.1291, 113.2644),
    "成都": (30.5728, 104.0668),
    "杭州": (30.2741, 120.1551),
    "深圳": (22.5431, 114.0579),
    "武汉": (30.5928, 114.3055),
    "南京": (32.0603, 118.7969),
}


@router.get("/current")
async def get_weather(city: str = Query("北京", description="城市名称")):
    """获取当前天气"""
    coords = CITY_COORDS.get(city, CITY_COORDS["北京"])
    lat, lon = coords

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                BASE_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m",
                    "daily": "temperature_2m_max,temperature_2m_min,weather_code",
                    "forecast_days": 7,
                    "timezone": "Asia/Shanghai",
                },
            )
            data = resp.json()

        current = data.get("current", {})
        daily = data.get("daily", {})

        weather_codes = {
            0: "晴", 1: "晴", 2: "多云", 3: "阴",
            45: "雾", 48: "雾凇", 51: "小雨", 53: "中雨", 55: "大雨",
            61: "小雨", 63: "中雨", 65: "大雨", 71: "小雪", 73: "中雪", 75: "大雪",
            80: "阵雨", 81: "阵雨", 82: "暴雨", 95: "雷暴", 96: "冰雹", 99: "冰雹",
        }
        code = current.get("weather_code", 0)
        wcode = daily.get("weather_code", [code])[0] if daily.get("weather_code") else code

        return {
            "city": city,
            "current": {
                "temp": current.get("temperature_2m"),
                "feels_like": current.get("apparent_temperature"),
                "humidity": current.get("relative_humidity_2m"),
                "wind_speed": current.get("wind_speed_10m"),
                "condition": weather_codes.get(code, "未知"),
                "weather_code": code,
            },
            "forecast": [
                {
                    "date": daily.get("time", [None])[i] if i < len(daily.get("time", [])) else None,
                    "high": daily.get("temperature_2m_max", [None])[i] if i < len(daily.get("temperature_2m_max", [])) else None,
                    "low": daily.get("temperature_2m_min", [None])[i] if i < len(daily.get("temperature_2m_min", [])) else None,
                    "code": (daily.get("weather_code", [0])[i] if i < len(daily.get("weather_code", [])) else 0),
                    "condition": weather_codes.get((daily.get("weather_code", [0])[i] if i < len(daily.get("weather_code", [])) else 0), "未知"),
                }
                for i in range(min(7, len(daily.get("time", []))))
            ],
        }
    except Exception as e:
        return JSONResponse({"error": str(e), "city": city}, status_code=500)
