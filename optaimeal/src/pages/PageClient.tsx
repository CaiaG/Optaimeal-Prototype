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
    setWeeklyAssignment(MOCK_WEEKLY_MENU);
    
    if (MOCK_WEEKLY_MENU.length > 0) {
      setSelectedDay(MOCK_WEEKLY_MENU[0].day);
    }
  }, []);

  // map day to index
  const currentMeal = weeklyAssignment.find(m => m.day === selectedDay);

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
        {/* Main page showing basic meal stats */}
        {activeView === 'main' && currentMeal ? (
          <div className="meal-details-view">
          <header>
            <h1>{currentMeal.day} - {currentMeal.date}</h1>
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