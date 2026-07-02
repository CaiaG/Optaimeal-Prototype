import styles from './PageOpp.module.css';
import { useState, useEffect } from 'react';

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
export const MOCK_WEEKLY_MENU: MealPlan[] = [
  {
    id: 0,
    meal_name: "Gobbeldy Gook",
    recipe_id: 101,
    status: "Active", // Must be "Draft" | "Active" | "Archived" [7, 8]
    calories: 450,
    nutritional_score: 3.5,
    ingredients: ["water", "beans", "maize"], // string[] for multi-language names [5, 9]
    assignment_date: "2026-07-01",
    client_ids: [10], // number[] for Menu Sending feature [11, 12]
    estimated_cost: 12
  },
  {
    id: 1,
    meal_name: "Codswallop",
    recipe_id: 102,
    status: "Draft",
    calories: 520,
    nutritional_score: 8.0,
    ingredients: ["fish", "potatoes"],
    assignment_date: "2026-07-02",
    client_ids: [13, 14],
    estimated_cost: 3
  },
  {
    id: 2,
    meal_name: "Balderdash",
    recipe_id: 103,
    status: "Archived",
    calories: 349,
    nutritional_score: 2.0,
    ingredients: ["rice", "lentils", "carrots"],
    assignment_date: "2026-07-03",
    client_ids: [14-19],
    estimated_cost: 3
  },
  {
    id: 3,
    meal_name: "Stinky Winky",
    recipe_id: 104,
    status: "Active",
    calories: 610,
    nutritional_score: 9.5,
    ingredients: ["beef", "onions", "tomatoes"],
    assignment_date: "2026-07-04",
    client_ids: [20-23],
    estimated_cost: 99
  },
  {
    id: 4,
    meal_name: "Bubble and Squeak",
    recipe_id: 105,
    status: "Draft",
    calories: 983,
    nutritional_score: 5.0,
    ingredients: ["cabbage", "potatoes", "leftover greens"],
    assignment_date: "2026-07-05",
    client_ids: [15, 24-26],
    estimated_cost: 193
  }
];

export default function PageOpp() {

  
  const [activeView, setActiveView] = useState('home'); 
  const [addMode, setAddMode] = useState('button');
  const [chatInput, setChatInput] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<MealPlan>();
  const [chatHistory, setChatHistory] = useState([
    { sender: 'System', text: "Start chat" }
  ]);
  const [meals, setMeals] = useState<MealPlan[]>([]);

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
    setSelectedMeal(new MealPlan());
    setActiveView('generate');
  };

  useEffect(() => {
    setMeals(MOCK_WEEKLY_MENU);
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
              <p><small>{meal.assignment_date}</small></p>
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
              Back to Dashboard
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
              <button className={styles.add_ing_btn}>Add Ingredient</button>
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

              // add a send msg button lol
              <div className={styles.chatbot_interface}>
                <div className={styles.chat_window}>
                  <p className={styles.system_msg}>
                    <strong>System:</strong> {selectedMeal 
                      ? "I've loaded the menu scenario. How would you like to optimize it?" 
                      : "Tell me the requirements for your new menu scenario."}
                  </p>
                </div>
                <div className={styles.chat_input_box}>
                  <textarea placeholder="type here..." />
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
          <div className={styles.saved_container}>
            <header className={styles.saved_header}>
              <button className={styles.back_btn} onClick={() => setActiveView('home')}>
                Back to Dashboard
              </button>
              <h2>Saved Menu Drafts</h2>
              <p>Manage your long-term meal plans here.</p>
            </header>

            <div className={styles.saved_list_controls}>
              <input type="text" placeholder="Search saved meals..." className={styles.search_bar} />
              <select className={styles.filter_dropdown}>
                <option value="all">All States</option>
                <option value="Draft">Drafts Only</option>
                <option value="Active">Active Plans</option>
              </select>
            </div>

            <div className={styles.saved_grid}>
              {meals.map((meal) => (
                <div key={meal.meal_name} className={styles.saved_item_card}>
                  <div className={styles.card_header}>
                    <h3>{meal.meal_name}</h3>
                  </div>
                  <p><strong>{meal.calories} kcal</strong> | {meal.assignment_date}</p>
                  <button 
                    className={styles.edit_btn} 
                    onClick={() => handleEditMeal(meal)}
                  >
                    Open & Edit
                  </button>
                </div>
              ))}
            </div>
  
          </div>
        ) : (
          <p>e</p>
        )}
      </main>
    </div>
  );
}