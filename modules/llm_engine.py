import os
from openai import OpenAI
import json

def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)

def analyze_content(text):
    """
    Analyzes website text using OpenAI.
    """
    try:
        client = get_openai_client()
        prompt = f"""
        You are an expert business analyst. Given the following company name and website, do real research (using your knowledge and reasoning) and return a JSON object with:
        {{
            "company_name": "The real name of the company (never a placeholder)",
            "what_they_do": "A real, concise summary of what this company does (2-3 sentences, never a template)",
            "contacts": [
                {{
                    "name": "If you can infer a real contact name, otherwise null",
                    "role": "If you can infer a real role, otherwise null",
                    "email": "A real company email address, or guess a likely one like info@domain if not found",
                    "context": "How you found or inferred this contact, or null"
                }}
            ],
            "key_value_props": ["List of my services that best match this company (real, never prop1/prop2)"]
        }}

        My services are: Organic SEO, Local SEO, Google Ads, Meta Ads, Social Media, Content Marketing, Web Development, App Development, Automation & Consulting.
        Map the most relevant of these to the company based on their business.

        Company Info:
        {text[:15000]}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        print(f"Error in OpenAI analysis: {e}")
        return {
            "company_name": "Unknown",
            "what_they_do": "Analysis failed",
            "contacts": [],
            "error": str(e)
        }

def generate_email(analysis, contact=None, recommended_services=None):
    """
    Generates a personalized bilingual cold email using OpenAI.
    Returns english_body (para 1) and spanish_body (para 2) separately.
    """
    try:
        client = get_openai_client()
        recipient_info = f"Recipient: {contact.get('name')} ({contact.get('role')})" if contact else "General Inbox"

        company_name = analysis.get('company_name', '')
        what_they_do = analysis.get('what_they_do', analysis.get('summary', ''))
        services = analysis.get('key_value_props', [])
        website = ''
        if 'website' in analysis:
            website = analysis['website']

        # Use recommended_services if provided (from smart-research flow)
        services_to_mention = []
        if recommended_services and isinstance(recommended_services, list):
            for svc in recommended_services:
                if isinstance(svc, dict):
                    services_to_mention.append(svc.get('service_name', ''))
                elif isinstance(svc, str):
                    services_to_mention.append(svc)
        if not services_to_mention:
            services_to_mention = services

        services_list_str = ', '.join(services_to_mention) if services_to_mention else 'SEO, digital marketing, and automation'

        prompt = f"""
        You are an expert B2B outreach copywriter writing on behalf of Team DaPros (SERP Hawk Digital Agency). Use ONLY the provided company info below. Do not invent details.

        PROSPECT INFO:
        Company: {company_name}
        Website: {website}
        What they do: {what_they_do}
        {recipient_info}

        SERVICES TO HIGHLIGHT: {services_list_str}

        OUR FULL SERVICE CATALOG (for context):
        • Organic SEO — higher Google rankings, more organic traffic
        • Local SEO — dominate Google Maps & local search
        • Google Ads — targeted PPC with measurable ROI
        • Meta Ads — Facebook & Instagram campaigns that convert
        • Social Media — brand presence & audience engagement
        • Content Marketing — SEO blogs, landing pages, conversion copy
        • Web Development — fast, modern, conversion-optimized sites
        • App Development — custom mobile & web applications
        • Automation & Consulting — smart workflows & strategy

        EMAIL STRUCTURE (English):
        1. Hook (1-2 sentences) — A specific observation about {company_name}'s online presence or an opportunity you spotted. Make it personal.
        2. Problem/Opportunity (2-3 sentences) — A concrete challenge they likely face based on their industry and what they do.
        3. Service Spotlight (3-5 sentences) — For EACH service in [{services_list_str}], write one clear sentence: what it does + the measurable result for them. Use concrete outcomes like "rank on page 1", "2x local visibility", "cut ad spend waste by 30%".
        4. Social proof (1 sentence) — Mention working with similar businesses to build trust.
        5. CTA (1 sentence) — Invite them to a free 15-minute strategy call. Make it effortless.
        6. Sign-off: "Warm regards,\nTeam DaPros from Mexico | SERP Hawk Digital Agency"

        STYLE: 120-180 words total. Short paragraphs (2-3 sentences each), separated by blank lines. Conversational, confident, zero fluff. Services are the STAR — the reader should finish knowing exactly what you offer and why it matters for them.

        Then provide the FULL Spanish translation with identical structure, signed as "Equipo DaPros de México | SERP Hawk Digital Agency".

        Return a JSON object with exactly these fields:
        {{
            "subject": "Short benefit-focused subject (under 8 words, mention company or sector)",
            "english_body": "Full English email (short paragraphs separated by \\n\\n, plain text, no HTML)",
            "spanish_body": "Full Spanish translation (same structure, plain text, no HTML)"
        }}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        # Ensure backward compatibility with 'body' key
        result["body"] = result.get("english_body", "") + "\n\n" + result.get("spanish_body", "")
        return result
    except Exception as e:
        return {"subject": "Error", "english_body": str(e), "spanish_body": "", "body": str(e)}

def analyze_document(image_bytes):
    """
    Analyzes a business card or ID card image using GPT-4o Vision and returns extracted JSON.
    Tries gpt-4o-mini first, falls back to gpt-4o on failure.
    """
    import base64
    client = get_openai_client()
    base64_image = base64.b64encode(image_bytes).decode('utf-8')

    print(f"OCR: Received image, size={len(image_bytes)} bytes")

    # Auto-detect MIME type from file magic bytes
    if len(image_bytes) >= 4 and image_bytes[:4] == b'\x89PNG':
        mime_type = "image/png"
    elif len(image_bytes) >= 2 and image_bytes[:2] == b'\xff\xd8':
        mime_type = "image/jpeg"
    elif len(image_bytes) >= 6 and image_bytes[:6] in (b'GIF87a', b'GIF89a'):
        mime_type = "image/gif"
    elif len(image_bytes) >= 12 and image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        mime_type = "image/webp"
    else:
        mime_type = "image/jpeg"

    print(f"OCR: Detected MIME type: {mime_type}")

    prompt = (
        "You are an expert at reading business cards and ID cards. "
        "Examine this image carefully and extract every piece of contact information visible.\n"
        "Look for: full names, company/organization names, phone numbers, mobile numbers, "
        "email addresses, and website URLs.\n"
        "Return ONLY a valid JSON object with exactly these keys:\n"
        '{\n'
        '  \"name\": \"Full name of the person (empty string if not found)\",\n'
        '  \"company_name\": \"Company or organization name (empty string if not found)\",\n'
        '  \"mobile\": \"Phone or mobile number (empty string if not found)\",\n'
        '  \"email\": \"Email address (empty string if not found)\",\n'
        '  \"website\": \"Website URL (empty string if not found)\"\n'
        '}\n'
        "Do not add any other fields or explanations. Return only the JSON."
    )

    # Try gpt-4o-mini first, fall back to gpt-4o if it fails
    for model in ["gpt-4o-mini", "gpt-4o"]:
        try:
            print(f"OCR: Trying model {model}...")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}",
                                    "detail": "low"
                                }
                            },
                        ],
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=500
            )

            raw = response.choices[0].message.content
            print(f"OCR raw response from {model}: {raw}")
            result = json.loads(raw)

            # Ensure all required fields exist
            result.setdefault("name", "")
            result.setdefault("company_name", "")
            result.setdefault("mobile", "")
            result.setdefault("email", "")
            result.setdefault("website", "")

            print(f"OCR Success ({model}): {result}")
            return result

        except Exception as e:
            print(f"OCR Error with {model}: {type(e).__name__}: {e}")
            if model == "gpt-4o":
                # Both models failed
                return {
                    "error": f"OCR failed: {str(e)}",
                    "name": "",
                    "company_name": "",
                    "mobile": "",
                    "email": "",
                    "website": ""
                }
            continue
