import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    APP_NAME: str = "PactPay"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    
    # PayPal Sandbox Configuration
    PAYPAL_ENV: str = os.getenv("PAYPAL_ENV", "sandbox")
    PAYPAL_BASE_URL: str = (
        "https://api-m.sandbox.paypal.com" 
        if os.getenv("PAYPAL_ENV", "sandbox") == "sandbox" 
        else "https://api-m.paypal.com"
    )
    PAYPAL_CLIENT_ID: str = os.getenv("PAYPAL_CLIENT_ID", "mock_client_id")
    PAYPAL_CLIENT_SECRET: str = os.getenv("PAYPAL_CLIENT_SECRET", "mock_client_secret")
    PAYPAL_WEBHOOK_ID: str = os.getenv("PAYPAL_WEBHOOK_ID", "")
    
    # Platform wallet email for simulated sandbox payouts
    PLATFORM_PAYOUT_SENDER: str = os.getenv("PLATFORM_PAYOUT_SENDER", "platform-escrow@pactpay.ai")
    
    # Database
    DB_PATH: str = os.getenv("DB_PATH", "pactpay.db")

settings = Settings()
