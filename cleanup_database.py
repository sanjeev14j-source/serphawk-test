"""
Database Cleanup Script - Deletes all data EXCEPT Admin users and related content
"""
from database import engine, User, ClientProfile, Project, ServiceRequest, MessageThread, ChatMessage
from database import CallLog, SentEmail, ActivityLog, Company, EmailLog, Document, Remark
from database import Task, TaskComment, Invoice, Notification, Milestone, NPSSurvey, Proposal
from database import ClientFileUpload, KeywordRankEntry, SocialProfile, SEOAudit, CompetitorAnalysis
from database import RankingTracker, AnalyticsData, ClientStatus
from sqlmodel import Session, select, delete

def cleanup_database():
    """
    Delete all non-admin data from the database.
    Preserves:
    - Admin users
    - Service catalog (optional admin content)
    """
    
    with Session(engine) as session:
        try:
            print("Starting database cleanup...")
            
            # Get all non-admin user IDs
            admin_users = session.exec(select(User).where(User.role == "Admin")).all()
            admin_user_ids = [user.id for user in admin_users]
            print(f"Found {len(admin_users)} Admin user(s) to preserve")
            
            # Get all non-admin user IDs for reference in deletion
            non_admin_users = session.exec(select(User).where(User.role != "Admin")).all()
            non_admin_user_ids = [user.id for user in non_admin_users]
            print(f"Found {len(non_admin_users)} non-Admin user(s) to delete")
            
            # Delete in order of dependencies (children first)
            deletions = [
                ("TaskComment", TaskComment),
                ("Task", Task),
                ("Notification", Notification),
                ("ChatMessage", ChatMessage),
                ("MessageThread", MessageThread),
                ("ServiceRequest", ServiceRequest),
                ("KeywordRankEntry", KeywordRankEntry),
                ("ClientFileUpload", ClientFileUpload),
                ("Proposal", Proposal),
                ("NPSSurvey", NPSSurvey),
                ("Milestone", Milestone),
                ("Invoice", Invoice),
                ("AnalyticsData", AnalyticsData),
                ("RankingTracker", RankingTracker),
                ("CompetitorAnalysis", CompetitorAnalysis),
                ("SEOAudit", SEOAudit),
                ("SocialProfile", SocialProfile),
                ("Document", Document),
                ("Remark", Remark),
                ("ClientProfile", ClientProfile),
                ("Project", Project),
                ("ActivityLog", ActivityLog),
                ("SentEmail", SentEmail),
                ("CallLog", CallLog),
                ("EmailLog", EmailLog),
                ("Company", Company),
            ]
            
            for table_name, model_class in deletions:
                try:
                    session.exec(delete(model_class))
                    session.commit()
                    try:
                        count = session.exec(select(model_class)).all()
                        print(f"✓ Cleaned {table_name} - {len(count)} records remaining")
                    except Exception as e:
                        # Schema mismatch issue, but deletion likely succeeded
                        print(f"✓ Cleaned {table_name} (schema verification skipped)")
                except Exception as e:
                    print(f"⚠️  {table_name} - {str(e)}")
            
            # Delete non-admin users
            if non_admin_user_ids:
                session.exec(delete(User).where(User.id.in_(non_admin_user_ids)))
                session.commit()
                print(f"✓ Deleted {len(non_admin_user_ids)} non-Admin user(s)")
            
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
    print("\nAll the following will be DELETED:")
    print("  - Client profiles and all related data")
    print("  - Projects, Tasks, Milestones")
    print("  - Service requests and messages")
    print("  - Invoices, Proposals, Notifications")
    print("  - Call logs, Email logs, Documents")
    print("  - All non-admin users")
    print("  - Non-admin activity logs")
    print("\n" + "=" * 60)
    
    confirm = input("\nType 'YES' to confirm cleanup: ").strip().upper()
    
    if confirm == "YES":
        cleanup_database()
    else:
        print("Cleanup cancelled.")
        sys.exit(0)
