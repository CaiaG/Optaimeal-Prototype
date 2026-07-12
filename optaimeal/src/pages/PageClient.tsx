import styles from './PageClient.module.css';
import { useState, useEffect } from 'react';
import { createEmptyMeal, type MealPlan } from './types/mealplan';

export default function PageClient() {
  
  const [activeView, setActiveView] = useState('main'); 
  const [weeklyAssignment, setWeeklyAssignment] = useState<MealPlan[]>([]);
  const [selectedDay, setSelectedDay] = useState('Monday'); 
  const [unavailableIngredients, setUnavailableIngredients] = useState<string[]>([]);
  const currentMeal = weeklyAssignment.find(m => m.assignment_date === selectedDay);

  useEffect(() => {
    fetch('http://localhost:8000/api/client/menu/current')
      .then(res => res.json())
      .then(data => {
        setWeeklyAssignment(data);
        
        if (Array.isArray(data) && data.length > 0) {
          setSelectedDay(data[0].assignment_date);
        }
      })
      .catch(err => console.error("Error fetching menu:", err));
  }, []);

  return (
    <div className={styles.client_container}>
      <Sidebar 
        assignments={weeklyAssignment} 
        selectedDay={selectedDay} 
        onDaySelect={setSelectedDay} 
        onViewChange={setActiveView} 
      />

      <main className={styles.main_content}>
        {activeView === 'main' && currentMeal && (
          <MainView 
            meal={currentMeal} 
            unavailable={unavailableIngredients} 
            onToggleIngredient={setUnavailableIngredients} 
          />
        )}
        {activeView === 'chat' && <ChatView assignments={weeklyAssignment} selectedDay={selectedDay} onDaySelect={setSelectedDay}/>}
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

  return (
    <div className={styles.meal_details_view}>
      <header>
        {new Date(meal.assignment_date).toLocaleDateString('en-US', { weekday: 'long' })} - {meal.assignment_date}
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
        
        {meal.ingredients.map((ing: string, i: number) => {
          const isUnavailable = unavailable.includes(ing); 
          return (
            <div
              key={i}
              className={`${styles.ingredient_item} ${isUnavailable ? styles.crossed_out : ''}`}
              onClick={() => toggle(ing)} 
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
    const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
    
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
                        <p><strong>Calories:</strong> {currentMeal?.calories || 'N/A'}</p>
                        <p><strong>Estimated Cost:</strong> {currentMeal?.estimated_cost|| 'Medium'}</p>
                      </div>

                      <div className={styles.ingredients_list}>
                        <h4>Ingredients</h4>
                        <ul>
                          {currentMeal?.ingredients.map((ing: string, index: number) => (
                            <li key={index}>{ing}</li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  </div>
              </div>
      </div>
    );
  }
}