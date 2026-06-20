import styles from './PageClient.module.css';
import { useState, useEffect } from 'react';

// casing syntax is inconsistent...

interface MealPlan {
  day: string;
  date: string;
  meal_name: string;
  calories: number;
  ingredients: number[];
}

const MOCK_WEEKLY_MENU = [
  { day: "Monday", date: "2026-06-22", meal_name: "Gobbeldy Gook", calories: 450, ingredients: [1] },
  { day: "Tuesday", date: "2026-06-23", meal_name: "Codswallop", calories: 312, ingredients: [2, 3] },
  { day: "Wednesday", date: "2026-06-23", meal_name: "Balderdash", calories: 5, ingredients: [2, 4] },
  { day: "Thursday", date: "2026-06-23", meal_name: "Stinky Winky", calories: 17, ingredients: [1, 3, 5] },
  { day: "Friday", date: "2026-06-23", meal_name: "Bubble and Squeak", calories: 723, ingredients: [2, 3, 7] },
  { day: "Saturday", date: "2026-06-23", meal_name: "Upsy Daisy", calories: 222, ingredients: [1, 5, 6] },
  { day: "Sunday", date: "2026-06-23", meal_name: "Mud", calories: 821, ingredients: [7, 8, 9] },
];

export default function PageOne() {
  const dayToIndex: Record<string, number>= {
  "Monday": 0,
  "Tuesday": 1,
  "Wednesday" : 2,
  "Thursday" : 3,
  "Friday" : 4,
  "Saturday" : 5,
  "Sunday" : 6,
  };

  const [activeView, setActiveView] = useState('main'); 
  const [weeklyAssignment, setWeeklyAssignment] = useState<MealPlan[]>([]);
  const [selectedDay, setSelectedDay] = useState('Monday'); 


  useEffect(() => {
    setWeeklyAssignment(MOCK_WEEKLY_MENU);
    
    if (MOCK_WEEKLY_MENU.length > 0) {
      setSelectedDay(MOCK_WEEKLY_MENU[0].day);
    }
  }, []);


  return (
    <div className={styles.client_container}>
      
      <div className = {styles.sidebar_wrapper}>
        {/* Top Sidebar */}
        <nav className={styles.top_sidebar}>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('main')}>Main</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('chat')}>Chat</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('calendar')}>Weekly Planner</button>
        </nav>
     
        {/* Mini Calendar */}
        <aside className={styles.mini_calendar}>
          <button className={styles.mini_calendar_btns} onClick={() => setSelectedDay('Monday')}>Monday</button>
          <button className={styles.mini_calendar_btns} onClick={() => setSelectedDay('Tuesday')}>Tuesday</button>
          <button className={styles.mini_calendar_btns} onClick={() => setSelectedDay('Wednesday')}>Wednesday</button>
          <button className={styles.mini_calendar_btns} onClick={() => setSelectedDay('Thursday')} >Thursday</button>
          <button className={styles.mini_calendar_btns} onClick={() => setSelectedDay('Friday')}>Friday</button>
          <button className={styles.mini_calendar_btns} onClick={() => setSelectedDay('Saturday')}>Saturday</button>
          <button className={styles.mini_calendar_btns} onClick={() => setSelectedDay('Sunday')}>Sunday</button>
        </aside>
      </div>

      <main className={styles.main_content}>
        {activeView === 'main' ? (
          <div className="meal-details-view">
          <h1>{selectedDay}</h1>
          <p>{weeklyAssignment[dayToIndex[selectedDay]]?.meal_name}</p>
          <section className="stats">Calories: 450 kcal | Protein: 20g</section>
          <section className="ingredients">
            <label><input type="checkbox" /> Ingredient 1</label>
          </section>
        </div>

        ) : activeView === 'chat' ? (
          <p>chat</p>

        ) : activeView === 'calendar' ? (

          <p>calendar</p>
        ) : (
          <p>No Content State</p>
        )}
      </main>
      
    </div>
  );
}

{/* 

<aside className="mini-calendar">
  {weeklyAssignments.map((assignment) => (
    <button key={assignment.date}>
      {assignment.day} <br />
      <small>{assignment.date}</small>
    </button>
  ))}
</aside>
*/}