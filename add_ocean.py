from sqlmodel import Session, select
from backend.database import engine
from backend.models import Preset

def main():
    with Session(engine) as session:
        # Check if it already exists to avoid duplicates
        existing = session.exec(select(Preset).where(Preset.name == "Ocean Flow Ceiling")).first()
        if existing:
            print("Preset 'Ocean Flow Ceiling' already exists in the database.")
            return

        p = Preset(
            name="Ocean Flow Ceiling",
            is_on=True,
            transition=10,
            effect_id=43,        # Sinelon (or 82 for Colorwaves)
            effect_speed=40,     # Slow and ambient
            effect_intensity=150,# Wide wave bands
            palette_id=0,        # Default palette
            color1="#0055FF",    # Deep Electric Blue
            color2="#000000",    # Black (off state between waves)
            color3="#000000"
        )
        session.add(p)
        session.commit()
        print("Successfully added 'Ocean Flow Ceiling' preset to the database!")

if __name__ == "__main__":
    main()
