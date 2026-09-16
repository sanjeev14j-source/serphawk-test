"""
Import contacts from Excel file into the database
Creates User accounts and ClientProfile records
"""
import pandas as pd
from database import engine, User, ClientProfile
from sqlmodel import Session, select
import sys

def import_contacts():
    """Import contacts from cleaned_contacts.xlsx"""
    
    # Load Excel file
    try:
        df = pd.read_excel('cleaned_contacts.xlsx')
        print(f"Loaded {len(df)} contacts from Excel file")
    except Exception as e:
        print(f"❌ Error loading Excel file: {e}")
        return False
    
    # Clean up data
    df = df.dropna(subset=['Emails'])  # Remove rows without emails
    df['Company'] = df['Company'].fillna('Unknown Company')
    df['Website'] = df['Website'].fillna('')
    
    print(f"Processing {len(df)} valid contacts with emails...")
    
    with Session(engine) as session:
        imported_count = 0
        skipped_count = 0
        errors = []
        
        # Default password (plain text, matching app convention)
        default_password = "password123"
        
        for idx, row in df.iterrows():
            try:
                email = str(row['Emails']).strip().lower()
                company_name = str(row['Company']).strip()
                website = str(row['Website']).strip() if pd.notna(row['Website']) else ""
                
                # Skip if email is invalid
                if not email or email == 'nan' or '@' not in email:
                    skipped_count += 1
                    continue
                
                # Check if user already exists
                existing_user = session.exec(
                    select(User).where(User.email == email)
                ).first()
                
                if existing_user:
                    skipped_count += 1
                    print(f"  ⊘ {email} already exists")
                    continue
                
                # Create new User
                user = User(
                    email=email,
                    password=default_password,
                    name=company_name,
                    role="Client",
                    createdAt=None,
                    updatedAt=None
                )
                session.add(user)
                session.flush()  # Flush to get the user ID
                
                # Create ClientProfile linked to user
                client = ClientProfile(
                    userId=user.id,
                    companyName=company_name,
                    websiteUrl=website if website else None,
                    status="Active"
                )
                session.add(client)
                session.commit()
                
                imported_count += 1
                if imported_count % 50 == 0:
                    print(f"  ✓ Processed {imported_count} contacts...")
                    
            except Exception as e:
                skipped_count += 1
                errors.append(f"Row {idx}: {str(e)[:80]}")
                session.rollback()
                continue
        
        print(f"\n" + "=" * 60)
        print(f"✅ IMPORT COMPLETED")
        print(f"=" * 60)
        print(f"✓ Successfully imported: {imported_count} clients")
        print(f"⊘ Skipped: {skipped_count} (duplicates or invalid)")
        print(f"Default password: password123")
        
        if errors and len(errors) <= 10:
            print(f"\nErrors encountered:")
            for error in errors[:10]:
                print(f"  {error}")
        
        return imported_count > 0

if __name__ == "__main__":
    print("=" * 60)
    print("CLIENT IMPORT SCRIPT")
    print("=" * 60)
    print("\nThis will import contacts from cleaned_contacts.xlsx")
    print("- Creates User accounts with email addresses")
    print("- Sets default password to: password123")
    print("- Creates associated ClientProfile records")
    print("\n" + "=" * 60)
    
    confirm = input("\nType 'YES' to proceed with import: ").strip().upper()
    
    if confirm == "YES":
        if import_contacts():
            print("\n✅ Import successful!")
            sys.exit(0)
        else:
            print("\n❌ Import failed")
            sys.exit(1)
    else:
        print("Import cancelled.")
        sys.exit(0)
