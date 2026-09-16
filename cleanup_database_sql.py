"""
Database Cleanup Script using Raw SQL - Deletes all data EXCEPT Admin users
"""
from database import engine, User
from sqlmodel import Session, select, text

def cleanup_database_sql():
    """
    Delete all non-admin data from the database using raw SQL.
    Preserves:
    - Admin users
    - Service catalog (optional admin content)
    """
    
    with Session(engine) as session:
        try:
            print("Starting database cleanup with raw SQL...")
            
            # Get all non-admin user IDs
            admin_users = session.exec(select(User).where(User.role == "Admin")).all()
            admin_user_ids = [user.id for user in admin_users]
            print(f"Found {len(admin_users)} Admin user(s) to preserve")
            
            # Get all non-admin user IDs
            non_admin_users = session.exec(select(User).where(User.role != "Admin")).all()
            non_admin_user_ids = [user.id for user in non_admin_users]
            print(f"Found {len(non_admin_users)} non-Admin user(s) to delete")
            
            # Set all foreign key references to NULL where possible to avoid constraints
            print("Clearing foreign key references...")
            try:
                session.exec(text('UPDATE "client_profiles" SET "userId" = NULL'))
                session.exec(text('UPDATE "client_profiles" SET "projectId" = NULL'))
                session.exec(text('UPDATE "activity_logs" SET "userId" = NULL'))
                session.exec(text('UPDATE "activity_logs" SET "clientId" = NULL'))
                session.exec(text('UPDATE "documents" SET "uploaderId" = NULL'))
                session.exec(text('UPDATE "documents" SET "clientId" = NULL'))
                session.commit()
                print("✓ Foreign key references cleared")
            except Exception as e:
                print(f"⚠️  Could not clear all FK references: {str(e)[:80]}")
                session.rollback()
            
            # List of tables to truncate (in order of dependencies)
            tables_to_truncate = [
                "task_comments",
                "tasks",
                "notifications",
                "chat_messages",
                "message_threads",
                "service_requests",
                "keyword_rank_entries",
                "client_file_uploads",
                "proposals",
                "nps_surveys",
                "milestones",
                "invoices",
                "analytics_data",
                "ranking_tracker",
                "competitor_analyses",
                "seo_audits",
                "social_profiles",
                "documents",
                "remarks",
                "client_profiles",
                "projects",
                "activity_logs",
                "sent_emails",
                "call_logs",
                "email_logs",
                "companies",
            ]
            
            # Delete all data from these tables
            for table in tables_to_truncate:
                try:
                    session.exec(text(f'DELETE FROM "{table}"'))
                    session.commit()
                    print(f"✓ Cleaned {table}")
                except Exception as e:
                    print(f"⚠️  {table}: {str(e)[:80]}")
                    session.rollback()
            
            # Delete non-admin users
            if non_admin_user_ids:
                placeholders = ",".join([str(id) for id in non_admin_user_ids])
                try:
                    session.exec(text(f"DELETE FROM users WHERE id IN ({placeholders})"))
                    session.commit()
                    print(f"✓ Deleted {len(non_admin_user_ids)} non-Admin user(s)")
                except Exception as e:
                    print(f"❌ Could not delete users: {str(e)[:80]}")
                    session.rollback()
            
            # Verify admin users still exist
            remaining_admins = session.exec(select(User).where(User.role == "Admin")).all()
            print(f"\n✓ Preserved {len(remaining_admins)} Admin user(s)")
            for admin in remaining_admins:
                print(f"  - {admin.email} (ID: {admin.id})")
            
            print("\n✅ Database cleanup completed successfully!")
            print("All non-admin data has been deleted.")
            
        except Exception as e:
            print(f"❌ Error during cleanup: {str(e)}")
            session.rollback()
            raise

if __name__ == "__main__":
    import sys
    
    # Confirmation prompt
    print("=" * 60)
    print("⚠️  DATABASE CLEANUP SCRIPT")
    print("=" * 60)
    print("\nThis script will DELETE all data EXCEPT:")
    print("  - Admin users")
    print("  - Service catalog")
    print("\nALL OTHER DATA will be PERMANENTLY DELETED:")
    print("  - All client profiles and related data")
    print("  - All projects, tasks, and milestones")
    print("  - All service requests and messages")
    print("  - All invoices, proposals, and notifications")
    print("  - All call logs, email logs, and documents")
    print("  - All non-admin users")
    print("\n" + "=" * 60)
    
    confirm = input("\nType 'YES' to confirm cleanup: ").strip().upper()
    
    if confirm == "YES":
        cleanup_database_sql()
    else:
        print("Cleanup cancelled.")
        sys.exit(0)
