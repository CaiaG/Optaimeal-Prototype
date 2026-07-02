import styles from './PageClient.module.css';
import { useState, useEffect } from 'react';

// casing syntax is inconsistent...

export type MealStatus = 'Draft' | 'Active' | 'Archived';

// move to own class file soon
export class MealPlan {
  id: number;                 
  meal_name: string;           
  recipe_id: number | null;     
  status: MealStatus;
  calories: number;            
  nutritional_score: number;  
  ingredients: string[];       
  assignment_date: string;    
  client_ids: number[];        
  estimated_cost: number;    

  constructor() {
    this.id = -1;
    this.meal_name = "";
    this.recipe_id = -1; 
    this.status = "Draft";
    this.calories = -1;
    this.nutritional_score = -1;
    this.ingredients = [];
    this.assignment_date = "";
    this.client_ids = [];
    this.estimated_cost = -1;
  }
}

export default function PageClient() {
  
  const [activeView, setActiveView] = useState('main'); 
  const [weeklyAssignment, setWeeklyAssignment] = useState<MealPlan[]>([]);
  const [selectedDay, setSelectedDay] = useState('Monday'); 
  const [unavailableIngredients, setUnavailableIngredients] = useState<string[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
  { sender: 'System', text: "Start chat" }
]);

  // ingredient checklist toggle
  const toggleIngredient = (ingredientName: string) => {
    setUnavailableIngredients((prev) =>
      prev.includes(ingredientName)
        ? prev.filter((i) => i !== ingredientName)
        : [...prev, ingredientName]             
    );
  };

  // should automatically set to monday? -> eventually current day
  useEffect(() => {

    fetch('http://localhost:8000/api/client/menu/current')
      .then(res => res.json())
      .then(data => {
        setWeeklyAssignment(data);
        if (data.length > 0) {
          // Default to Monday
          setSelectedDay(data.assignment_date);
        }
      })
      .catch(err => console.error("Error fetching menu:", err));

/*
    setWeeklyAssignment(MOCK_WEEKLY_MENU);
    
    if (MOCK_WEEKLY_MENU.length > 0) {
      setSelectedDay(MOCK_WEEKLY_MENU[0].day);
    }*/
  }, []);

  // map day to index
  const currentMeal = weeklyAssignment.find(m => m.assignment_date === selectedDay);

  // regen button for ingredients page
  const handleRegeneration = () => {
    setIsRegenerating(true);
    // send req
    setTimeout(() => {
      setIsRegenerating(false);
      // update the weekly state 
    }, 2500); // 2.5 seconds placeholder
  };

  // send message handler
  const handleSendMessage = () => {
    // if empty message ignores
    if (chatInput.trim() === '') return;

    // user message
    const newMessage = { sender: 'User', text: chatInput };
    setChatHistory([...chatHistory, newMessage]);

    setChatInput('');
    // automatically set to "feedback received" after user "sends" messgae
    setTimeout(() => {
      setChatHistory(prev => [...prev, { 
        sender: 'System', 
        text: "Feedback received." 
      }]);
    }, 1000);
  };

  // reset chat
  const handleReset = () => {
    setChatHistory([
      { sender: 'System', text: "Yo" }
    ]);
    
    setChatInput('');
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
              key={m.assignment_date} 
              className={`${styles.mini_calendar_btns} ${selectedDay === m.assignment_date ? styles.active : ''}`}
              onClick={() => setSelectedDay(m.assignment_date)}
            >
              {m.assignment_date}
            </button>
          ))}
        </aside>
      </div>

      <main className={styles.main_content}>
        {/* Main page showing basic meal stats */}
        {activeView === 'main' && currentMeal ? (
          <div className="meal-details-view">
          <header>
            {new Date(currentMeal.assignment_date).toLocaleDateString('en-US', { weekday: 'long' })} - {currentMeal.assignment_date}
            <h2>{currentMeal.meal_name}</h2>
          </header>
          
          <section className={styles.stats_box}>
              {/* not in meal plan ds yet */}
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
            {isRegenerating ? "Updating..." : "Regenerate Meal"}

          </button>
        </div>

        // Chat interface
        ) : activeView === 'chat' ? (

          <div className={styles.chat_container}>
            <header className={styles.chat_header}>
              <h2>Chat</h2>
              <button className={styles.reset_chat_btn} onClick={handleReset}>Reset</button>
            </header>

            <div className={styles.chat_window}>
              {chatHistory.map((msg, index) => (
              <div key={index} className={msg.sender === 'User' ? styles.user_msg : styles.system_msg}>
                <p><strong>{msg.sender}:</strong> {msg.text}</p>
              </div>
            ))}
            </div>

            {/* chat input */}
            <footer className={styles.chat_input_area}>
            
            <input 
              type="text" 
              placeholder="Type meal feedback here..." 
              className={styles.chat_input_mock} 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyUp={(e) => e.key === 'Enter' && handleSendMessage()} 
            />

            {/* Send message */}
            <button className={styles.send_btn} onClick={handleSendMessage}>
              Send
            </button>
            </footer>
            
          </div>

        ) : activeView === 'calendar' ? (

          <p>calendar</p>
        ) : (
          <p>No Content State</p>
        )}
      </main>
      
    </div>
  );
}