import styles from './PageOpp.module.css';
import { useState, useEffect } from 'react';

interface MealPlan {
  day: string;
  date: string;
  meal_name: string;
  calories: number;
  //meal_id: number;
  //calories_per_serve: number;
  //nutritional_score: number;
  ingredients: string[];
}

const MealPlan = () => ({
  day: "",
  date: "",
  meal_name: "",
  calories: 0,
  ingredients: []
});


export default function PageOpp() {

  const MOCK_WEEKLY_MENU = [
  { day: "Monday", date: "2026-06-22", meal_name: "Gobbeldy Gook", calories: 450, ingredients: ["aadffa", "onpasj", "oihohoi"] },
  { day: "Tuesday", date: "2026-06-23", meal_name: "Codswallop", calories: 312, ingredients: ["ajkbc"] },
  { day: "Wednesday", date: "2026-06-23", meal_name: "Balderdash", calories: 5, ingredients: ["ljdvh"] },
  { day: "Thursday", date: "2026-06-23", meal_name: "Stinky Winky", calories: 17, ingredients: ["bndakv"] },
  { day: "Friday", date: "2026-06-23", meal_name: "Bubble and Squeak", calories: 723, ingredients: ["bwg e"] },
  { day: "Saturday", date: "2026-06-23", meal_name: "Upsy Daisy", calories: 222, ingredients: ["ph ei "] },
  { day: "Sunday", date: "2026-06-23", meal_name: "Mud", calories: 821, ingredients: ["oqhtn"] },
];

  const [activeView, setActiveView] = useState('home'); 
  const [addMode, setAddMode] = useState('button');
  const [chatInput, setChatInput] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<MealPlan>();
  const [chatHistory, setChatHistory] = useState([
    { sender: 'System', text: "Start chat" }
  ]);

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

  const handleEditMeal = (meal: MealPlan) => {
    setSelectedMeal(meal); 
    setActiveView('generate');
  };

  const handleCreateNew = () => {
    setSelectedMeal(MealPlan());
    setActiveView('generate');
  };

  useEffect(() => {
  }, []);

  return (
    <div className={styles.opp_container}>
      <aside className={styles.sidebar_wrapper}>
        <nav className={styles.top_sidebar}>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('home')}>Main</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('generate')}>Generate</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('calendar')}>Calendar</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('saved')}>Saved</button>

        </nav>
      </aside>

      <main className={styles.main_content}>
        {activeView === 'home' ? (
          <div className={styles.home_wrapper}>
        
        <section className={styles.recent_meals_scroll}>         

          {addMode === 'button' ? (
            <div className={styles.add_new_card} onClick={() => setAddMode('options')}>
              <span>+ Add New Meal</span>
            </div>
          ) : (
            <div className={styles.add_options_card}>
              <button 
                className={styles.option_btn} 
                onClick={handleCreateNew}
              >
                Create from Scratch
              </button>
              <button 
                className={styles.option_btn} 
                onClick={() => { 
                      setActiveView('saved'); 
                      setAddMode('button'); 
                    }}               >
              Load from Database
              </button>
              <button className={styles.cancel_link} 
                onClick={() => setAddMode('button')}
              >
                Cancel
              </button>
            </div>
          )}

          {MOCK_WEEKLY_MENU.map((meal, index) => (
            <div key={index} className={styles.meal_card}          
              onClick={() => {
                    setSelectedMeal(meal); 
                    setActiveView('generate');
                  }}               
              style={{ cursor: 'pointer' }}
            >
              <h4>{meal.meal_name}</h4>
              <p><small>{meal.date}</small></p>
              <div className={styles.meal_stats_preview}>
                <span>{meal.calories} kcal</span>
              </div>
            </div>
          ))}            
        </section>

        <section className={styles.scenario_tool_area}>
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
        </section>
      </div>

        // Chat interface
        ) : activeView === 'generate' ? (
          <div className={styles.generate_container}>
          {/* 1. Header & Navigation */}
          <header className={styles.generate_header}>
            <button className={styles.back_btn} onClick={() => setActiveView('home')}>
              ← Back to Dashboard
            </button>
            <h2>{selectedMeal ? `Editing: ${selectedMeal.meal_name}` : "Create New Scenario"}</h2>
          </header>

          <div className={styles.generate_content_grid}>
            {/* 2. Manual Edit/Stats Area */}
            <section className={styles.meal_details_form}>
              <div className={styles.input_group}>
                <label>Recipe Name</label>
                <input 
                  type="text" 
                  defaultValue={selectedMeal?.meal_name || ""} 
                  placeholder="e.g., Lentil Stew" 
                />
              </div>
              <div className={styles.input_group}>
                <label>Target Calories</label>
                <input 
                  type="number" 
                  defaultValue={selectedMeal?.calories || ""} 
                />
              </div>

              <h3>Ingredients</h3>
              <ul className={styles.ingredients_list}>
                {(selectedMeal?.ingredients || ["No ingredients yet"]).map((ing, i) => (
                  <li key={i} className={styles.ingredient_item}>
                    {ing} <button className={styles.remove_ing}>×</button>
                  </li>
                ))}
              </ul>
              <button className={styles.add_ing_btn}>+ Add Ingredient</button>
            </section>

            {/* 3. LLM Scenario Tool & Metrics (The "Central Brain") */}
            <section className={styles.llm_tool_section}>
              <div className={styles.metrics_dashboard}>
                <div className={styles.metric_card}>
                  <span>Nutritional Score</span>
                  <strong>{selectedMeal ? selectedMeal.calories: "--"}</strong>
                </div>
                <div className={styles.metric_card}>
                  <span>Est. Cost per Serving</span>
                  <strong>{selectedMeal ? selectedMeal.calories : "--"}</strong>
                </div>
              </div>

              <div className={styles.chatbot_interface}>
                <div className={styles.chat_window}>
                  <p className={styles.system_msg}>
                    <strong>System:</strong> {selectedMeal 
                      ? "I've loaded the scenario. How would you like to optimize it?" 
                      : "Tell me the requirements for your new menu scenario."}
                  </p>
                </div>
                <div className={styles.chat_input_box}>
                  <textarea placeholder="e.g., Swap beans for a local high-protein alternative..." />
                  <button className={styles.run_scenario_btn}>Run Optimization</button>
                </div>
              </div>

              <div className={styles.action_footer}>
                <button className={styles.save_draft_btn}>Save as Draft</button>
                <button className={styles.assign_btn}>Assign to Client</button>
              </div>
            </section>
          </div>
        </div>

        ) : activeView === 'calendar' ? (

          <p>c</p>
        ) : activeView === 'saved' ? (
          <p>d</p>
        ) : (
          <p>e</p>
        )}
      </main>
    </div>
  );
}