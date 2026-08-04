import styles from './PageClient.module.css';
import { useState, useEffect } from 'react';
import { createEmptyMeal, type MealPlan } from './types/mealplan';

export const parseIngredients = (ingredients: string[] | string | undefined | null): string[] => {
  if (Array.isArray(ingredients)) {
    return ingredients;
  }
  if (typeof ingredients === 'string' && ingredients.trim() !== '') {
    return ingredients.split(',').map((item) => item.trim());
  }
  return [];
};

export default function PageClient() {
  const [clientId, setClientId] = useState<number | null>(null);
  const [inputClientId, setInputClientId] = useState<string>('');
  const [isClientModalOpen, setIsClientModalOpen] = useState<boolean>(true);
  const [activeView, setActiveView] = useState('main'); 
  const [weeklyAssignment, setWeeklyAssignment] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState('Monday'); 
  const [unavailableIngredients, setUnavailableIngredients] = useState<string[]>([]);

  // Safely find the current meal with Array.isArray guard
  const currentMeal = Array.isArray(weeklyAssignment)
    ? weeklyAssignment.find(m => m.assignment_date === selectedDay)
    : null;

  useEffect(() => {
    if (!clientId) return;

    fetch(`http://localhost:8000/api/client/menu/current/${clientId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch menu for this client.");
        return res.json();
      })
      .then((data) => {
        // Build the 5-day Monday-Friday schedule
        const fullWeek = buildFullWeekSchedule(data);
        setWeeklyAssignment(fullWeek);

        // Default selected day to Monday's date (or today if it's Mon-Fri)
        if (fullWeek.length > 0) {
          const todayKey = new Date().toISOString().split('T')[0];
          const todayMatch = fullWeek.find((d) => d.assignment_date === todayKey);
          setSelectedDay(todayMatch ? todayMatch.assignment_date : fullWeek[0].assignment_date);
        }
      })
      .catch((err) => {
        console.error("Error fetching menu:", err);
        // Fallback: build an empty Mon-Fri schedule if server error occurs
        const emptyWeek = buildFullWeekSchedule([]);
        setWeeklyAssignment(emptyWeek);
        setSelectedDay(emptyWeek[0].assignment_date);
      });
  }, [clientId]);

  const buildFullWeekSchedule = (rawAssignments: any[]) => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();

    // Calculate Monday's date for current week
    const distanceToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMon);

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const assignmentsArray = Array.isArray(rawAssignments) ? rawAssignments : [rawAssignments];

    return dayNames.map((dayName, index) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + index);
      
      // Format date as YYYY-MM-DD
      const dateKey = dayDate.toISOString().split('T')[0];

      // Check if backend has an assignment for this date or day name
      const existing = assignmentsArray.find(
        (item) => item && (item.assignment_date === dateKey || item.assignment_date === dayName)
      );

      if (existing) {
        return {
          ...existing,
          assignment_date: dateKey,
          day_name: dayName,
          isAssigned: true,
        };
      }

      // Blank placeholder
      return {
        assignment_date: dateKey,
        day_name: dayName,
        meal_id: null,
        meal_name: 'No Meal Assigned',
        status: 'Unassigned',
        calories_per_serving: 0,
        nutritional_score: 0,
        ingredients: '',
        isAssigned: false,
      };
    });
  };

  const handleClientSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const parsedId = Number(inputClientId);
    if (!parsedId || isNaN(parsedId)) {
      alert("Please enter a valid numeric Client ID");
      return;
    }
    setClientId(parsedId);
    setIsClientModalOpen(false);
  };

  return (
    <div className={styles.client_container}>
      <Sidebar 
        assignments={weeklyAssignment} 
        selectedDay={selectedDay} 
        onDaySelect={setSelectedDay} 
        onViewChange={setActiveView} 
      />

      {isClientModalOpen && (
        <div className={styles.modal_overlay}>
          <div className={`${styles.modal_content} ${styles.client_modal}`}>
            <h3>Enter Client ID</h3>
            <p className={styles.modal_subtitle}>
              Please enter your Client ID to view your scheduled meals.
            </p>

            <form onSubmit={handleClientSubmit}>
              <input 
                type="number" 
                placeholder="Client ID (e.g. 1)"
                value={inputClientId}
                onChange={(e) => setInputClientId(e.target.value)}
                autoFocus
                required
                className={styles.client_input}
              />

              <div className={styles.modal_actions}>
                <button type="submit" className={styles.submit_button}>
                  View Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className={styles.main_content}>
        {activeView === 'main' && currentMeal && (
          <MainView 
            meal={currentMeal.meal || currentMeal} 
            unavailable={unavailableIngredients} 
            onToggleIngredient={setUnavailableIngredients} 
          />
        )}
        {activeView === 'chat' && (
          <ChatView 
            assignments={weeklyAssignment} 
            selectedDay={selectedDay} 
            onDaySelect={setSelectedDay}
          />
        )}
        {activeView === 'calendar' && <p>Calendar Placeholder</p>}
      </main>
    </div>
  );


  function Sidebar({ assignments, selectedDay, onDaySelect, onViewChange }: any) {
    return (
      <div className={styles.sidebar_wrapper}>
        <nav className={styles.top_sidebar}>
          {['main', 'chat', 'calendar'].map((view) => (
            <button 
              key={view} 
              onClick={() => onViewChange(view)}
              className={styles.top_sidebar_btn}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
              
            </button>
          ))}
        </nav>
        
        <aside className={styles.mini_calendar}>
          {assignments.map((m: MealPlan) => {
            const isSelected = String(selectedDay) === String(m.assignment_date);
            
            return (
              <button 
                key={m.assignment_date} 
                // Join the classes properly
                className={`${styles.mini_calendar_btns} ${isSelected ? styles.active : ''}`}
                onClick={() => onDaySelect(m.assignment_date)}
              >
                {m.assignment_date}
              </button>
            );
          })}
        </aside>
      </div>
    );
  }

  function MainView({ meal, unavailable, onToggleIngredient }: any) {
    const toggle = (ing: string) => {
      onToggleIngredient((prev: string[]) => 
        prev.includes(ing) ? prev.filter(i => i !== ing) : [...prev, ing]
      );
    };
    const ingredientsList = parseIngredients(meal?.ingredients);

    return (
      <div className={styles.meal_details_view}>
        <header>
          {/* Fallback to meal.day_name if assignment_date parsing fails on empty days */}
          {meal.assignment_date 
            ? new Date(meal.assignment_date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) 
            : meal.day_name} 
          - {meal.assignment_date}
          <h2>{meal.meal_name}</h2>
        </header>
        
        <section className={styles.stats_box}></section>
        
        <section className={styles.quantity_section}>
          <label>Nr of students: </label>
          <input type="number" placeholder="q" />
        </section>

        <section className={styles.ingredients}>
          <h3>Ingredients Checklist</h3>
          <p><small>Mark unavailable items with an [X]</small></p>
          
          {ingredientsList.length > 0 ? (
            ingredientsList.map((ing: string, i: number) => {
              const isUnavailable = unavailable.includes(ing); 
              return (
                <div 
                  key={i} 
                  onClick={() => toggle(ing)}
                  style={{ 
                    cursor: 'pointer', 
                    textDecoration: isUnavailable ? 'line-through' : 'none',
                    color: isUnavailable ? 'red' : 'inherit',
                    marginBottom: '0.5rem'
                  }}
                >
                  [{isUnavailable ? 'X' : ' '}] {ing}
                </div>
              );
            })
          ) : (
            <p style={{ color: '#888', fontStyle: 'italic' }}>No ingredients listed.</p>
          )}
        </section>

        <button
          className={styles.regenerate_btn}
          onClick={() => alert("Regenerate logic should be handled here or passed as a prop")}
        >
          Regenerate Meal
        </button>
      </div>
    );
  }

  function ChatView({ assignments, selectedDay, onDaySelect }: { assignments: MealPlan[], selectedDay: any, onDaySelect: any}) {
    const [chatInput, setChatInput] = useState('');
    const [history, setHistory] = useState([{ sender: 'System', text: "Start chat" }]);
    
    const handleSendMessage = () => {
      if (!chatInput.trim()) return;
      
      const newMessage = { sender: 'User', text: chatInput };
      setHistory(prev => [...prev, newMessage]);
      setChatInput('');

      setTimeout(() => {
        setHistory(prev => [...prev, { sender: 'System', text: "Feedback received." }]);
      }, 1000);
    };

    const handleReset = () => {
      setHistory([{ sender: 'System', text: "Yo" }]);
      setChatInput('');
    };
    const currentMeal = assignments.find((m: any) => m.assignment_date === selectedDay);
    const ingredientList = parseIngredients(currentMeal?.ingredients);

    return (
      <div className ={styles.chat_wrapper}>
        <div className={styles.chat_container}>
                <header className={styles.chat_header}>
                  <h2>Chat</h2>
                  <button className={styles.reset_chat_btn} onClick={handleReset}>Reset</button>
                </header>

                <div className={styles.chat_window}>
                  {history.map((msg, index) => (
                    <div key={index} className={msg.sender === 'User' ? styles.user_msg : styles.system_msg}>
                      <p><strong>{msg.sender}:</strong> {msg.text}</p>
                    </div>
                  ))}
                </div>

                <footer className={styles.chat_input_area}>
                  <input
                    type="text"
                    placeholder="Type meal feedback here..."
                    className={styles.chat_input_mock}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyUp={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button className={styles.send_btn} onClick={handleSendMessage}>
                    Send
                  </button>
                </footer>

                
              </div>
              <div className={styles.meal_selector_box}>
                  <h3>Select Meal to Edit</h3>
                  {assignments.map((m) => (
                    <button 
                      className={styles.chat_meal_btns}
                      key={m.assignment_date} 
                      onClick={() => onDaySelect(m.assignment_date)}
                    >
                      {m.meal_name}
                    </button>
                  ))}
                  <div className={styles.meal_card}>
                    <section>
                      <h3>{currentMeal?.meal_name}</h3>
    
                      <div className={styles.meta_info}>
                        <p><strong>Calories:</strong> {currentMeal?.calories_per_serving || 'N/A'}</p>
                        <p><strong>Estimated Cost:</strong> {"n/a"}</p>
                      </div>

                      <div className={styles.ingredients_list}>
                        <h4>Ingredients</h4>
                        <ul>
                          {ingredientList.length > 0 ? (
                            ingredientList.map((ing: string, index: number) => (
                              <li key={index}>{ing}</li>
                            ))
                          ) : (
                            <li>No ingredients listed</li>
                          )}
                        </ul>
                      </div>
                    </section>
                  </div>
              </div>
      </div>
    );
  }
}