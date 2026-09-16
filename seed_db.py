from database import engine, User, Session
from sqlmodel import select

def seed_admin():
    with Session(engine) as session:
        statement = select(User).where(User.email == "admin@example.com")
        existing_admin = session.exec(statement).first()
        
        if not existing_admin:
            admin = User(
                email="admin@example.com",
                password="password123",
                name="System Admin",
                role="Admin"
            )
            session.add(admin)
            session.commit()
            print("✅ Admin user created: admin@example.com / password123")
        else:
            print("Admin user already exists.")

if __name__ == "__main__":
    seed_admin()
