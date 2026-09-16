# --- Dapros Service Mapping and Research ---
import json
from modules.llm_engine import analyze_content

# Dapros services (can be loaded from DB/config in future)
DAPROS_SERVICES = [
    "Local and Organic SEO",
    "PPC Advertising",
    "Web Development",
    "Artificial intelligence",
    "Ecommerce",
    "Secure Hosting"
]

def map_services_to_dapros(company_services, dapros_services=DAPROS_SERVICES):
    """
    Use OpenAI to map company services to dapros services.
    """
    # Compose a prompt for mapping
    prompt = f"""
    You are an expert B2B analyst. Given the following list of company services and Dapros's services, map each company service to the most relevant Dapros service (or 'None' if no match). Return a JSON list of mappings like:
    [{{"company_service": "...", "dapros_service": "..."}}]

    Company Services: {json.dumps(company_services)}
    Dapros Services: {json.dumps(dapros_services)}
    """
    from modules.llm_engine import get_openai_client
    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)

async def research_and_map_company(url, dapros_services=DAPROS_SERVICES):
    """
    Scrape a company website, analyze with OpenAI, and map their services to Dapros's.
    Returns: dict with analysis, mapping, and suggested inbound/outbound requests.
    """
    website_text = await scrape_website(url)
    analysis = analyze_content(website_text)
    # Try to extract company services from analysis (fallback to empty list)
    company_services = analysis.get("key_value_props") or []
    mapping = map_services_to_dapros(company_services, dapros_services)
    # Suggest inbound/outbound requests
    prompt = f"""
    Given the following mapping between a company's services and Dapros's services, suggest:
    - 2 outbound service requests (Dapros to company)
    - 2 inbound service requests (company to Dapros)
    Return as JSON: {{"outbound": [..], "inbound": [..]}}

    Mapping: {json.dumps(mapping)}
    Dapros Services: {json.dumps(dapros_services)}
    """
    client = get_openai_client()
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    suggestions = json.loads(resp.choices[0].message.content)
    return {
        "company_analysis": analysis,
        "service_mapping": mapping,
        "suggested_requests": suggestions
    }
import re
import requests
from bs4 import BeautifulSoup
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def scrape_website(url):
    """
    Fetches the website content using Requests and BeautifulSoup.
    This replaces Playwright to avoid browser download requirements.
    """
    # Ensure URL has schema
    if not url.startswith('http'):
        url = 'https://' + url
        
    logger.info(f"Scraping URL: {url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    try:
        # 1. Fetch the page
        # specific timeout to prevent hanging
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        # 2. Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 3. Clean up script and style elements
        for script in soup(["script", "style", "nav", "footer", "header", "noscript", "iframe", "svg"]):
            script.decompose()
            
        # 4. Extract text
        text = soup.get_text(separator=' ')
        
        # 5. Clean whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        # 6. Basic email extraction (fallback if LLM misses it)
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        found_emails = list(set(re.findall(email_pattern, response.text)))
        
        # Combine text with found emails to help the LLM
        final_content = f"Source URL: {url}\n\nExtracted Emails: {', '.join(found_emails)}\n\nWebsite Content:\n{text[:15000]}" # Limit to 15k chars
        
        return final_content

    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP Error scraping {url}: {e}")
        return f"ERROR SCRAPING: HTTP {e.response.status_code}"
    except requests.exceptions.ConnectionError:
        logger.error(f"Connection Error scraping {url}")
        return "ERROR SCRAPING: Connection refused or host unreachable"
    except requests.exceptions.Timeout:
        logger.error(f"Timeout scraping {url}")
        return "ERROR SCRAPING: Request timed out"
    except Exception as e:
        logger.error(f"Unexpected error scraping {url}: {e}")
        return f"ERROR SCRAPING: {str(e)}"
