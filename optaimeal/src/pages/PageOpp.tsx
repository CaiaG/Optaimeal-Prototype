import styles from './PageOpp.module.css';
import { useState, useEffect } from 'react';
import { createEmptyMeal, type MealPlan } from './types/mealplan';

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
    client_ids: [14, 19],
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
    client_ids: [20, 23],
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
    client_ids: [15, 24, 26],
    estimated_cost: 193
  }
];

export default function PageOpp() {
  
  const [activeView, setActiveView] = useState('home'); 
  const [addMode, setAddMode] = useState('button');
  const [chatInput, setChatInput] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<MealPlan | null>(null);
  const [chatHistory, setChatHistory] = useState([
    { sender: 'System', text: "Start chat" }
  ]);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [ingredientInput, setIngredientInput] = useState('');
  


  const handleSendMessage = () => {
    // if empty message ignores
    if (chatInput.trim() === '') return;

    // user message
    const newMessage = { sender: 'User', text: chatInput };
    setChatHistory([...chatHistory, newMessage]);

    setChatInput('');
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
    setSelectedMeal(createEmptyMeal());
    setActiveView('generate');
  };

  const handleAddIngredient = (name: string) => {
    if (selectedMeal) {
      const updatedIngredients = [...selectedMeal.ingredients, name];
      setSelectedMeal({ ...selectedMeal, ingredients: updatedIngredients });
    }
  };

  const handleRemoveIngredient = (index: number) => {
    if (selectedMeal) {
      const updatedIngredients = selectedMeal.ingredients.filter((_, i) => i !== index);
      setSelectedMeal({ ...selectedMeal, ingredients: updatedIngredients });
    }
  };

  const handleNavigation = (view: string, meal: MealPlan | null = null) => {
    if (view === 'generate' && !meal) {
      setSelectedMeal(createEmptyMeal());
    } else {
      setSelectedMeal(meal);
    }
    
    setActiveView(view);
  };

  

  useEffect(() => {
    setMeals(MOCK_WEEKLY_MENU);
  }, []);

   const MOCK_CLIENTS = [
    { id: 101, name: "Random Elementary" },
    { id: 102, name: "Random High" }
  ];

  const MOCK_DRAFTS = [
    { id: 1, name: "Baddabing" },
    { id: 2, name: "Badaboom" },
  ];

  
  type CalendarAssignments = Record<number, Record<string, string>>;

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedClientId, setSelectedClientId] = useState<number | null>(MOCK_CLIENTS[0]?.id || null);
  const [calendarAssignments, setCalendarAssignments] = useState<CalendarAssignments>({});

  const daysInMonth = (month: number, year: number): number => 
    new Date(year, month + 1, 0).getDate();

  const startDayOfMonth = new Date(
    calendarDate.getFullYear(), 
    calendarDate.getMonth(), 
    1
  ).getDay();
  const [activeMenuDate, setActiveMenuDate] = useState<string | null>(null);

  const handleSelectSavedMeal = (day: number, meal: any): void => {
    if (selectedClientId === null) return;

    const dateKey = `${calendarDate.getFullYear()}-${calendarDate.getMonth() + 1}-${day}`;

    setCalendarAssignments((prev: CalendarAssignments) => ({
      ...prev,
      [selectedClientId]: {
        ...(prev[selectedClientId] || {}),
        [dateKey]: meal.name, 
      },
    }));
    
    setActiveMenuDate(null);
  };

  const isDateLocked = (day: number): boolean => {
    const cellDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    const today = new Date();
    
    today.setHours(0, 0, 0, 0);
    
    return cellDate <= today;
  };


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
        {activeView === 'home' && <HomeView onSelect={handleNavigation} />}
        {activeView === 'generate' && <GenerateView meal={selectedMeal} onBack={() => setActiveView('home')} />}
        {activeView === 'calendar' && <CalendarView />}
        {activeView === 'saved' && <SavedView onEdit={(m) => handleNavigation('generate', m)} />}
      </main>
    </div>
  );

    
  function HomeView({ onSelect }: { onSelect: (v: string, m: MealPlan | null) => void }) {
    return (
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

              <footer className={styles.chat_input_area}>
                <textarea 
                  placeholder="Type requirements (e.g., 'sustainable menu for 500 students')..." 
                  className={styles.chat_input_mock} 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }} 
                />

                <div className={styles.chat_actions}>
                  
                </div>
              </footer>
            </div>
          </section>
        </div>
    );
  }

  function GenerateView({ meal, onBack }: { meal: MealPlan | null, onBack: () => void }) {
    const [data, setData] = useState<MealPlan>(meal || createEmptyMeal());

    return (
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

              <div className={styles.metrics_dashboard}>
                <div className={styles.metric_card}>
                  <span>Nutritional Score</span>
                  <strong>{selectedMeal ? selectedMeal.nutritional_score: "--"}</strong>
                </div>
                <div className={styles.metric_card}>
                  <span>Est. Cost per Serving</span>
                  <strong>{selectedMeal ? selectedMeal.calories : "--"}</strong>
                </div>
              </div>

              <section className={styles.ingredients_section}>
                <h3>Ingredients Checklist</h3>
                <ul className={styles.ingredients_list}>
                  {selectedMeal?.ingredients.map((ing, i) => (
                    <li key={i} className={styles.ingredient_item}>
                      <span>{ing}</span>
                      <button 
                        className={styles.remove_ing} 
                        onClick={() => handleRemoveIngredient(i)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>

                <div className={styles.add_ingredient_container}>
                  <input 
                    type="text" 
                    placeholder="Add new ingredient..." 
                    value={ingredientInput}
                    onChange={(e) => setIngredientInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddIngredient(ingredientInput);
                        setIngredientInput(''); 
                      }
                    }} 
                  />
                  <button 
                    className={styles.add_ing_btn} 
                    onClick={() => {
                      handleAddIngredient(ingredientInput);
                      setIngredientInput(''); 
                    }}
                  >
                    +
                  </button>
                </div>
              </section>
            </section>
            
            <section className={styles.llm_tool_section}>

              <header className={styles.chat_header}>
                <h2>Chat</h2>
                <button className={styles.reset_chat_btn} onClick={handleReset}>Reset</button>
              </header>

              <div className={styles.chatbot_interface}>
                <div className={styles.chat_window}>
                  {chatHistory.map((msg, index) => (
                    <p key={index} className={msg.sender === 'System' ? styles.system_msg : styles.user_msg}>
                      <strong>{msg.sender}:</strong> {msg.text}
                    </p>
                  ))}
                </div>

                <div className={styles.chat_input_box}>
                  <textarea 
                    placeholder="Type requirements here..." 
                    value={chatInput} 
                    onChange={(e) => setChatInput(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />

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
    );
  }

  function CalendarView() {
    return (
      <section className={styles.calendar_view_area}>
        <header className={styles.calendar_header}>
          <div className={styles.client_picker}>
            <label>Assigning for: </label>
            <select 
              value={selectedClientId || ''} 
              onChange={(e) => setSelectedClientId(Number(e.target.value))}
            >
              {MOCK_CLIENTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
              
          <div className={styles.month_nav}>
            <button onClick={() => setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() - 1)))}>
              &lt; Prev
            </button>
            <h2>{calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
            <button onClick={() => setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() + 1)))}>
              Next &gt;
            </button>
          </div>
        </header>

        <div className={styles.calendar_grid}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className={styles.day_label}>{d}</div>
          ))}
              
          {[...Array(startDayOfMonth)].map((_, i) => (
            <div key={`pad-${i}`} className={styles.day_empty} />
        ))}

          {[...Array(daysInMonth(calendarDate.getMonth(), calendarDate.getFullYear()))].map((_, i) => {
            const day = i + 1;
            const dateKey = `${calendarDate.getFullYear()}-${calendarDate.getMonth() + 1}-${day}`;
            const currentClientAssignments = selectedClientId ? calendarAssignments[selectedClientId] : null;
            const assignedMeal = currentClientAssignments ? currentClientAssignments[dateKey] : null;
            const locked = isDateLocked(day); 

            return (
              <div 
                key={day} 
                className={`${styles.calendar_cell} ${locked ? styles.locked : ''}`}
                onClick={() => !locked && setActiveMenuDate(dateKey)} 
              >                    
                <div className={styles.cell_header}>
                  <span className={styles.cell_date}>{day}</span>
                  <span className={locked ? styles.lock_icon : styles.add_icon}>
                  {locked ? '🔒' : '+'}
                  </span>
                </div>
                {assignedMeal && (
                  <div className={styles.assignment_tag}>
                    {assignedMeal}
                  </div>
                )}                  {!locked && activeMenuDate === dateKey && (
                  <div className={styles.dummy_menu_popup}>
                    <header className={styles.popup_header}>
                      <span>Saved Meals</span>
                    <button onClick={() => setActiveMenuDate(null)}>x</button>
                    </header>
                    <div className={styles.saved_meal_list}>
                      {MOCK_DRAFTS.map((meal) => (
                        <div 
                          key={meal.id} 
                          className={styles.dummy_menu_item}
                          onClick={() => handleSelectSavedMeal(day, meal)}
                        >
                          {meal.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}                    
              </div>
            );
          })}
        </div>

        <footer className={styles.calendar_actions}>
          <button className={styles.push_active_btn} onClick={() => alert("Assignments Pushed to Active Status")}>
            Push Weekly Assignments to School
          </button>
        </footer>      
      </section>       
    );
  }

  function SavedView({ onEdit }: { onEdit: (m: MealPlan) => void }) {
    return (
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
    );
  }
}
