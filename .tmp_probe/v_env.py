import os
from dotenv import load_dotenv
load_dotenv()
print("LLM_PROVIDER", os.getenv("LLM_PROVIDER"))
print("GROQ_LLM_MODEL", os.getenv("GROQ_LLM_MODEL"))
print("GROQ_API_KEY_SET", bool(os.getenv("GROQ_API_KEY")))
