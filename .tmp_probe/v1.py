from dotenv import load_dotenv
load_dotenv()
from core.llm_service import get_llm_service
s = get_llm_service()
print(type(s))
