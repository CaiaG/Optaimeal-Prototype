import styles from './PageClient.module.css';
import { useState, useEffect } from 'react';

// casing syntax is inconsistent...

interface MealPlan {
  day: string;
  date: string;
  meal_name: string;
  //meal_id: number;
  //calories_per_serve: number;
  //nutritional_score: number;
  ingredients: string[];
}

const MOCK_WEEKLY_MENU = [
  { day: "Monday", date: "2026-06-22", meal_name: "Gobbeldy Gook", calories: 450, ingredients: ["aadffa", "onpasj", "oihohoi"] },
  { day: "Tuesday", date: "2026-06-23", meal_name: "Codswallop", calories: 312, ingredients: ["ajkbc"] },
  { day: "Wednesday", date: "2026-06-23", meal_name: "Balderdash", calories: 5, ingredients: ["ljdvh"] },
  { day: "Thursday", date: "2026-06-23", meal_name: "Stinky Winky", calories: 17, ingredients: ["bndakv"] },
  { day: "Friday", date: "2026-06-23", meal_name: "Bubble and Squeak", calories: 723, ingredients: ["bwg e"] },
  { day: "Saturday", date: "2026-06-23", meal_name: "Upsy Daisy", calories: 222, ingredients: ["ph ei "] },
  { day: "Sunday", date: "2026-06-23", meal_name: "Mud", calories: 821, ingredients: ["oqhtn"] },
];

export default function PageOne() {
  

  const [activeView, setActiveView] = useState('main'); 
  const [weeklyAssignment, setWeeklyAssignment] = useState<MealPlan[]>([]);
  const [selectedDay, setSelectedDay] = useState('Monday'); 
  const [unavailableIngredients, setUnavailableIngredients] = useState<string[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const toggleIngredient = (ingredientName: string) => {
    setUnavailableIngredients((prev) =>
      prev.includes(ingredientName)
        ? prev.filter((i) => i !== ingredientName)
        : [...prev, ingredientName]             
    );
  };

  useEffect(() => {
    setWeeklyAssignment(MOCK_WEEKLY_MENU);
    
    if (MOCK_WEEKLY_MENU.length > 0) {
      setSelectedDay(MOCK_WEEKLY_MENU[0].day);
    }
  }, []);

  const currentMeal = weeklyAssignment.find(m => m.day === selectedDay);

  const handleRegeneration = () => {
    setIsRegenerating(true);
    // send req
    setTimeout(() => {
      setIsRegenerating(false);
      // update the weekly state 
    }, 2500); // 2.5 seconds placeholder
  };

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
         {weeklyAssignment.map((m) => (
            <button 
              key={m.day} 
              className={`${styles.mini_calendar_btns} ${selectedDay === m.day ? styles.active : ''}`}
              onClick={() => setSelectedDay(m.day)}
            >
              {m.day}
            </button>
          ))}
        </aside>
      </div>

      <main className={styles.main_content}>
        {activeView === 'main' && currentMeal ? (
          <div className="meal-details-view">
          <header>
            <h1>{currentMeal.day} - {currentMeal.date}</h1>
            <h2>{currentMeal.meal_name}</h2>
          </header>
          
          <section className={styles.stats_box}>
              {/* not in mp obj yet */}
          </section>

          <section className={styles.quantity_section}>
            <label>Nr of students: </label>
            <input type="number" placeholder="q" />
          </section>

          <section className={styles.ingredients}>
            <h3>Ingredients Checklist</h3>
            <p><small>Mark unavailable items with an [X]</small></p>
            
            {currentMeal.ingredients.map((ing, i) => {
              const isUnavailable = unavailableIngredients.includes(ing);
              
              return (
                <div 
                  key={i} 
                  className={`${styles.ingredient_item} ${isUnavailable ? styles.crossed_out : ''}`}
                  onClick={() => toggleIngredient(ing)}
                >
                  <span className={styles.custom_checkbox}>
                    {isUnavailable ? 'X' : ''}
                  </span>
                  <label>{ing}</label>
                </div>
              );
            })}
          </section>
          <button 
            className={styles.regenerate_btn}
            onClick={handleRegeneration}
            disabled={isRegenerating}
          >
            {isRegenerating ? "Optimizing..." : "Regenerate Meal"}

          </button>
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