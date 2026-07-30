import React, { useState, useEffect } from 'react';
import styles from './PageOpp.module.css'; // Assuming your CSS module import
import { createEmptyMeal, type MealPlan } from './types/mealplan';

// --- Types & Interfaces ---

// --- Mock Data & Helpers ---
export const MOCK_WEEKLY_MENU: MealPlan[] = [
  { meal_id: 0, meal_name: "Gobbeldy Gook", status: "Active", calories_per_serving: 450, nutritional_score: 3.5, ingredients: ["water", "beans", "maize"], assignment_date : ""},
  { meal_id: 1, meal_name: "Codswallop",  status: "Draft", calories_per_serving: 520, nutritional_score: 8.0, ingredients: ["fish", "potatoes"],assignment_date : ""},
  { meal_id: 2, meal_name: "Balderdash",  status: "Archived", calories_per_serving: 349, nutritional_score: 2.0, ingredients: ["rice", "lentils", "carrots"],assignment_date : ""},
  { meal_id: 3, meal_name: "Stinky Winky", status: "Active", calories_per_serving: 610, nutritional_score: 9.5, ingredients: ["beef", "onions", "tomatoes"],assignment_date : ""},
  { meal_id: 4, meal_name: "Bubble and Squeak", status: "Draft", calories_per_serving: 983, nutritional_score: 5.0, ingredients: ["cabbage", "potatoes", "leftover greens"],assignment_date : ""}
];

const MOCK_CLIENTS = [
  { id: 101, name: "Random Elementary" },
  { id: 102, name: "Random High" }
];


const MOCK_DRAFTS = [
  { id: 1, name: "Baddabing" },
  { id: 2, name: "Badaboom" },
];

// --- Main Application Component ---
export default function PageOpp() {
  const [activeView, setActiveView] = useState('home'); 
  const [selectedMeal, setSelectedMeal] = useState<MealPlan | null>(null);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  
  // Shared Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'System', text: "Start chat" }
  ]);

  // Shared Form/Draft State

  const [savedMealId, setSavedMealId] = useState<number | null>(null);

  useEffect(() => {
    setMeals(MOCK_WEEKLY_MENU);
  }, []);

  // --- Handlers ---
  const handleNavigation = (view: string, meal: MealPlan | null = null) => {
    if (view === 'generate' && !meal) {
      setSelectedMeal(createEmptyMeal());
    } else {
      setSelectedMeal(meal);
    }
    setActiveView(view);
  };

  const handleSendMessage = () => {
    if (chatInput.trim() === '') return;
    const newMessage = { sender: 'User', text: chatInput };
    setChatHistory([...chatHistory, newMessage]);
    setChatInput('');
    setTimeout(() => {
      setChatHistory(prev => [...prev, { sender: 'System', text: "Feedback received." }]);
    }, 1000);
  };

  const handleResetChat = () => {
    if (!selectedMeal) return;

    setChatHistory([{ sender: 'System', text: "Yo" }]);
    setChatInput('');
  };

  const handleSaveDraft = async () => {
    if (!selectedMeal) return null;

    const isExistingMeal = !!selectedMeal.meal_id; 

    const endpoint = selectedMeal?.meal_id 
      ? "http://localhost:8000/api/meal/" + selectedMeal.meal_id 
      : "http://localhost:8000/api/meals";

    const method = isExistingMeal ? 'PUT' : 'POST';

    const payload = {
      meal_name: selectedMeal.meal_name,
      status: selectedMeal.status,
      ingredients: selectedMeal.ingredients,
      calories_per_serving: selectedMeal.calories_per_serving,
      nutritional_score: selectedMeal.nutritional_score,
      assignment_date: selectedMeal.assignment_date
    };

    try {
      const response = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      const assignedId = data.meal_id || selectedMeal.meal_id || Date.now();
      
      setSavedMealId(assignedId);
      setSelectedMeal({ ...selectedMeal, meal_id: assignedId }); 

      if (response.ok) {
        alert("Draft saved successfully!");
        return assignedId;
      }
      return assignedId;
    } catch (e) {
      console.error("Save failed:", e);
      alert("Failed to save draft to the database. Please try again.");
    }
  };

  const handleSaveAndUpdateFrontend = async () => {
    const savedId = await handleSaveDraft();
    
    if (selectedMeal) {
      setMeals(prevMeals => {
        const mealToSave: MealPlan = { 
          ...selectedMeal, 
          meal_id: savedId, 
          status: 'Draft' as const
        };

        const existingIndex = prevMeals.findIndex(m => m.meal_id === mealToSave.meal_id);
        if (existingIndex >= 0) {
          const updatedMeals = [...prevMeals];
          updatedMeals[existingIndex] = mealToSave;
          return updatedMeals;
        }
        
        return [...prevMeals, mealToSave];
      });
    }
  };

  const handleAssignToClient = async (clientId: number | null) => {
    try {
      const response = await fetch('http://localhost:8000/api/operator/menu/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_id: savedMealId, 
          client_id: clientId,
          assignment_date: new Date().toISOString().split('T')[0] 
        })
      });
      if (response.ok) {
        alert("Meal assigned successfully!");
      }
    } catch (e) {
      alert("Meal assigned successfully (Mocked)!");
    }
  };

  return (
    <div className={styles.opp_container}>
      <aside className={styles.sidebar_wrapper}>
        <nav className={styles.top_sidebar}>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('home')}>Main</button>
          <button className={styles.top_sidebar_btn} onClick={() => handleNavigation('generate')}>Generate</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('calendar')}>Calendar</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('saved')}>Saved</button>
        </nav>
      </aside>

      <main className={styles.main_content}>
        {activeView === 'home' && (
          <HomeView 
            meals={meals} 
            onNavigate={handleNavigation} 
            chatInput={chatInput}
            setChatInput={setChatInput}
            chatHistory={chatHistory}
            onSendMessage={handleSendMessage}
            onResetChat={handleResetChat}
          />
        )}
        {activeView === 'generate' && (
          <GenerateView 
            meal={selectedMeal} 
            onUpdateMeal={setSelectedMeal}
            onBack={() => setActiveView('home')} 
            chatInput={chatInput}
            setChatInput={setChatInput}
            chatHistory={chatHistory}
            onSendMessage={handleSendMessage}
            onResetChat={handleResetChat}
            onSaveDraft={handleSaveAndUpdateFrontend}
            onAssignToClient={handleAssignToClient}
            savedMealId={savedMealId}
          />
        )}
        {activeView === 'calendar' && (
          <CalendarView />
        )}
        {activeView === 'saved' && (
          <SavedView 
            meals={meals} 
            onEdit={(m: MealPlan) => handleNavigation('generate', m)} 
            onBack={() => setActiveView('home')} 
          />
        )}
      </main>
    </div>
  );
}

// --- Extracted Components ---

function HomeView({ 
  meals, onNavigate, chatInput, setChatInput, chatHistory, onSendMessage, onResetChat 
}: any) {
  const [addMode, setAddMode] = useState('button');

  return (
    <div className={`${styles.home_wrapper} ${styles.animate_mount}`}>
      <section className={styles.recent_meals_scroll}>         
        {addMode === 'button' ? (
          <div className={styles.add_new_card} onClick={() => setAddMode('options')}>
            <span>+ Add New Meal</span>
          </div>
        ) : (
          <div className={styles.add_options_card}>
            <button 
              className={styles.option_btn} 
              onClick={() => onNavigate('generate', createEmptyMeal())}
            >
              Create from Scratch
            </button>
            <button 
              className={styles.option_btn} 
              onClick={() => { onNavigate('saved', null); setAddMode('button'); }}              
            >
              Load from Database
            </button>
            <button className={styles.cancel_link} onClick={() => setAddMode('button')}>
              Cancel
            </button>
          </div>
        )}

        {meals.map((meal: MealPlan, index: number) => (
          <div key={index} className={styles.meal_card}          
            onClick={() => onNavigate('generate', meal)}              
            style={{ cursor: 'pointer' }}
          >
            <h4>{meal.meal_name}</h4>
            <p><small>{"n/a"}</small></p>
            <div className={styles.meal_stats_preview}>
              <span>{meal.calories_per_serving} kcal</span>
            </div>
          </div>
        ))}            
      </section>

      <section className={styles.scenario_tool_area}>
        <div className={styles.chat_container}>
          <header className={styles.chat_header}>
            <h2>Chat</h2>
            <button className={styles.reset_chat_btn} onClick={onResetChat}>Reset</button>
          </header>

          <div className={styles.chat_window}>
            {chatHistory.map((msg: any, index: number) => (
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
                  onSendMessage();
                }
              }} 
            />
            <div className={styles.chat_actions}></div>
          </footer>
        </div>
      </section>
    </div>
  );
}

function GenerateView({ 
  meal, onUpdateMeal, onBack, chatInput, setChatInput, chatHistory, onSendMessage, onResetChat, onSaveDraft, onAssignToClient, savedMealId 
}: any) {
  const [ingredientInput, setIngredientInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddIngredient = (name: string) => {
    if (name.trim()) {
      const currentIngredients = meal?.ingredients || [];
      onUpdateMeal({ 
        ...meal, 
        ingredients: [...currentIngredients, name.trim()] 
      });
      setIngredientInput('');
    }
  };

  const handleRemoveIngredient = (index: number) => {
    if (meal && meal.ingredients) {
      onUpdateMeal({ 
        ...meal, 
        ingredients: meal.ingredients.filter((_: string, i: number) => i !== index) 
      });
    }
  };

  const handleAssignSubmit = (clientId: number | null) => {
    onAssignToClient(clientId);
    setIsModalOpen(false);
  };

  return (
    <div className={`${styles.generate_container} ${styles.animate_mount}`}>
      <header className={styles.generate_header}>
        <button className={styles.back_btn} onClick={onBack}>
          Back to Dashboard
        </button>
        <h2>{meal?.meal_name ? `Editing: ${meal.meal_name}` : "Create New Scenario"}</h2>
      </header>

      <div className={styles.generate_content_grid}>
        <section className={styles.meal_details_form}>
          <div className={styles.input_group}>
            <label>Recipe Name</label>
            <input 
              type="text" 
              value={meal?.meal_name || ""}  
              onChange={(e) => onUpdateMeal({ ...meal, meal_name: e.target.value })}
              placeholder="e.g., Lentil Stew" 
            />
          </div>
          <div className={styles.input_group}>
            <label>Target Calories</label>
            <input 
              type="number" 
              value={meal?.calories || ""} 
              onChange={(e) => onUpdateMeal({ ...meal, calories: Number(e.target.value) })}
            />
          </div>

          <div className={styles.metrics_dashboard}>
            <div className={styles.metric_card}>
              <span>Nutritional Score</span>
              <strong>{meal ? meal.nutritional_score : "--"}</strong>
            </div>
            <div className={styles.metric_card}>
              <span>Est. Cost per Serving</span>
              <strong>{meal ? meal.estimated_cost : "--"}</strong>
            </div>
          </div>

          <section className={styles.ingredients_section}>
            <h3>Ingredients List</h3>
            <ul className={styles.ingredients_list}>
              {meal?.ingredients.map((ing: string, i: number) => (
                <li key={i} className={styles.ingredient_item}>
                  <span>{ing}</span>
                  <button 
                    className={styles.remove_ing} 
                    onClick={() => handleRemoveIngredient(i)}
                  >×</button>
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
                  if (e.key === 'Enter') handleAddIngredient(ingredientInput);
                }} 
              />
              <button 
                className={styles.add_ing_btn} 
                onClick={() => handleAddIngredient(ingredientInput)}
              >+</button>
            </div>
          </section>
        </section>
        
        <section className={styles.llm_tool_section}>
          <header className={styles.chat_header}>
            <h2>Chat</h2>
            <button className={styles.reset_chat_btn} onClick={onResetChat}>Reset</button>
          </header>

          <div className={styles.chatbot_interface}>
            <div className={styles.chat_window}>
              {chatHistory.map((msg: any, index: number) => (
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
                    onSendMessage();
                  }
                }}
              />
              <button className={styles.run_scenario_btn}>Run Optimization</button>
            </div>
          </div>

          <div className={styles.action_footer}>
            <button 
              className={styles.save_draft_btn} 
              onClick={onSaveDraft}
            >
              Save
            </button>

            <button 
              className={styles.assign_btn}
              onClick={() => setIsModalOpen(true)}
              disabled={!savedMealId}
              style={{ opacity: savedMealId ? 1 : 0.5, cursor: savedMealId ? 'pointer' : 'not-allowed' }}
            >
              Assign to Client
            </button>
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div className={styles.modal_overlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modal_content} onClick={(e) => e.stopPropagation()}>
            <h3>Assign Meal to Client</h3>
            <button onClick={() => handleAssignSubmit(101)}>Assign to Random Elementary</button>
            <button onClick={() => setIsModalOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapper to prevent the mount animation from looping
const AnimatedCalendarWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <section className={`${styles.calendar_view} ${styles.animate_mount}`}>
      {children}
    </section>
  );
};

function CalendarView() {
  type CalendarAssignments = Record<number, Record<string, string>>;

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedClientId, setSelectedClientId] = useState<number | null>(MOCK_CLIENTS[0]?.id || null);
  const [calendarAssignments, setCalendarAssignments] = useState<CalendarAssignments>({});
  const [activeMenuDate, setActiveMenuDate] = useState<string | null>(null);

  const daysInMonth = (month: number, year: number): number => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();

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
    <AnimatedCalendarWrapper>
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
          const month = String(calendarDate.getMonth() + 1).padStart(2, '0');
          const d = String(day).padStart(2, '0');
          const dateKey = `${calendarDate.getFullYear()}-${month}-${d}`;          
          
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
              )}                  
              
              {!locked && activeMenuDate === dateKey && (
                <div className={styles.dummy_menu_popup}>
                  <header className={styles.popup_header}>
                    <span>Saved Meals</span>
                    <button onClick={(e) => { e.stopPropagation(); setActiveMenuDate(null); }}>x</button>
                  </header>
                  <div className={styles.saved_meal_list}>
                    {MOCK_DRAFTS.map((meal) => (
                      <div 
                        key={meal.id} 
                        className={styles.dummy_menu_item}
                        onClick={(e) => { e.stopPropagation(); handleSelectSavedMeal(day, meal); }}
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
    </AnimatedCalendarWrapper>
  );
}

function SavedView({ meals, onEdit, onBack }: any) {
  return (
    <div className={`${styles.saved_container} ${styles.animate_mount}`}>
      <header className={styles.saved_header}>
        <button className={styles.back_btn} onClick={onBack}>
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
        {meals.map((meal: MealPlan) => (
          <div key={meal.meal_id} className={styles.saved_item_card}>
            <div className={styles.card_header}>
              <h3>{meal.meal_name}</h3>
            </div>
            <p><strong>{meal.calories_per_serving} kcal</strong> | {"n/a"}</p>
            <button 
              className={styles.edit_btn} 
              onClick={() => onEdit(meal)}
            >
              Open & Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}