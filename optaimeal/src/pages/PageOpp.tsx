import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './PageOpp.module.css';
import { createEmptyMeal, type MealPlan, type Assignment } from './types/mealplan';

// --- Types & Interfaces ---
export interface Client {
  client_id: number;
  name: string;
}

interface HomeViewProps {
  meals: MealPlan[];
  onNavigate: (view: string, meal?: MealPlan | null) => void;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  chatHistory: Array<{ sender: string; text: string }>;
  onSendMessage: () => void;
  onResetChat: () => void;
}

interface GenerateViewProps {
  meal: MealPlan | null;
  onUpdateMeal: (meal: MealPlan) => void;
  onBack: () => void;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  chatHistory: Array<{ sender: string; text: string }>;
  onSendMessage: () => void;
  onResetChat: () => void;
  onSaveDraft: () => Promise<void>;
  onAssignToClient: (clientId: number, date: string) => Promise<void>;
  savedMealId: number | null;
}

interface CalendarViewProps {
  meals: MealPlan[];
}

interface SavedViewProps {
  meals: MealPlan[];
  onEdit: (meal: MealPlan) => void;
  onBack: () => void;
}

// --- Mock Data & Helpers ---
export const MOCK_WEEKLY_MENU: MealPlan[] = [
  { meal_id: 0, meal_name: "Gobbeldy Gook", status: "Active", calories_per_serving: 450, nutritional_score: 3.5, ingredients: ["water", "beans", "maize"], assignment_date: "" },
  { meal_id: 1, meal_name: "Codswallop", status: "Draft", calories_per_serving: 520, nutritional_score: 8.0, ingredients: ["fish", "potatoes"], assignment_date: "" },
  { meal_id: 2, meal_name: "Balderdash", status: "Archived", calories_per_serving: 349, nutritional_score: 2.0, ingredients: ["rice", "lentils", "carrots"], assignment_date: "" },
  { meal_id: 3, meal_name: "Stinky Winky", status: "Active", calories_per_serving: 610, nutritional_score: 9.5, ingredients: ["beef", "onions", "tomatoes"], assignment_date: "" },
  { meal_id: 4, meal_name: "Bubble and Squeak", status: "Draft", calories_per_serving: 983, nutritional_score: 5.0, ingredients: ["cabbage", "potatoes", "leftover greens"], assignment_date: "" }
];

const MOCK_CLIENTS: Client[] = [
  { client_id: 1, name: "Random Elementary" },
  { client_id: 2, name: "Random High" }
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
    setChatHistory((prev) => [...prev, newMessage]);
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

  
  const handleSaveAndUpdateFrontend = async () => {
    const savedId = await handleSaveDraft();
    if (!savedId || !selectedMeal) return;

    setMeals(prevMeals => {
      const mealToSave: MealPlan = { 
        ...selectedMeal, 
        meal_id: savedId, 
        status: 'Draft'
      };

      const existingIndex = prevMeals.findIndex(m => m.meal_id === mealToSave.meal_id);
      if (existingIndex >= 0) {
        const updatedMeals = [...prevMeals];
        updatedMeals[existingIndex] = mealToSave;
        return updatedMeals;
      }
      
      return [...prevMeals, mealToSave];
    });
  };

  // Accept date parameter in handleAssignToClient
const handleSaveDraft = async (showAlert = true): Promise<number | null> => {
  if (!selectedMeal) return null;

  const isExistingMeal = Boolean(selectedMeal.meal_id); 
  const endpoint = isExistingMeal 
    ? `http://localhost:8000/api/meal/${selectedMeal.meal_id}`
    : "http://localhost:8000/api/meal";

  const method = isExistingMeal ? 'PUT' : 'POST';

  const payload = {
    meal_name: selectedMeal.meal_name,
    status: selectedMeal.status,
    ingredients: selectedMeal.ingredients,
    calories_per_serving: selectedMeal.calories_per_serving,
    nutritional_score: selectedMeal.nutritional_score,
  };

  try {
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const savedMeal = await response.json();
    const assignedId = savedMeal.meal_id; 

    setSavedMealId(assignedId);
    setSelectedMeal((prev) => (prev ? { ...prev, meal_id: assignedId } : null));

    if (showAlert) {
      alert("Draft saved successfully!");
    }
    return assignedId;
  } catch (e) {
    console.error("Save failed:", e);
    alert("Failed to save draft to the database. Please check server connectivity.");
    return null;
  }
};

const handleAssignToClient = async (clientId: number | null, date: string) => {
  if (!clientId) return;

  const currentMealId = await handleSaveDraft(false);
  if (!currentMealId) return;

  try {
    const response = await fetch('http://localhost:8000/api/operator/menu/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_id: currentMealId,
        client_id: clientId,
        assignment_date: date
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to assign meal.");

    alert(data.message);

    setSelectedMeal((prev) => (
      prev ? { ...prev, status: "Active", assignment_date: date } : null
    ));
  } catch (e: any) {
    alert(`Assignment failed: ${e.message}`);
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
          <CalendarView meals={meals} />
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

// --- Sub-Components ---


function HomeView({ 
  meals, onNavigate, chatInput, setChatInput, chatHistory, onSendMessage, onResetChat 
}: HomeViewProps) {
  const [addMode, setAddMode] = useState('button');

  const scrollRef = useRef<HTMLElement>(null);
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isMouseDown.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
    isDragging.current = false; 
  };

  const handleMouseLeave = () => {
    isMouseDown.current = false;
  };

  const handleMouseUp = () => {
    isMouseDown.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || !scrollRef.current) return;
    e.preventDefault();
    
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5; 

    if (Math.abs(x - startX.current) > 5) {
      isDragging.current = true;
    }

    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleCardClick = (meal: MealPlan) => {
    // Don't navigate if user was dragging
    if (isDragging.current) return;
    onNavigate('generate', meal);
  };
  return (
    <div className={`${styles.home_wrapper} ${styles.animate_mount}`}>
      <section 
        ref={scrollRef}
        className={styles.recent_meals_scroll}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >        
        {addMode === 'button' ? (
          <div 
            className={styles.add_new_card} 
            onClick={() => !isDragging.current && setAddMode('options')}
          >
            <span>+ Add New Meal</span>
          </div>
        ) : (
          <div className={styles.add_options_card}>
            <button 
              className={styles.option_btn} 
              onClick={() => !isDragging.current && onNavigate('generate', createEmptyMeal())}
            >
              Create from Scratch
            </button>
            <button 
              className={styles.option_btn} 
              onClick={() => { 
                if (!isDragging.current) {
                  onNavigate('saved', null); 
                  setAddMode('button');
                }
              }}              
            >
              Load from Database
            </button>
            <button 
              className={styles.cancel_link} 
              onClick={() => !isDragging.current && setAddMode('button')}
            >
              Cancel
            </button>
          </div>
        )}

        {meals.map((meal: MealPlan) => (
          <div 
            key={meal.meal_id} 
            className={styles.meal_card}          
            onClick={() => handleCardClick(meal)}              
          >
            <h4>{meal.meal_name}</h4>
            <p><small>{meal.status}</small></p>
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
}: GenerateViewProps) {
  const [ingredientInput, setIngredientInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddIngredient = (name: string) => {
    if (name.trim() && meal) {
      const currentIngredients = meal.ingredients || [];
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
        ingredients: meal.ingredients.filter((_, i) => i !== index) 
      });
    }
  };


  const handleAssignSubmit = async (clientId: number) => {
    await onAssignToClient(clientId, assignmentDate);
    setIsModalOpen(false);
  };

  const rawIngredients = meal?.ingredients as unknown;

  const ingredientList: string[] = Array.isArray(rawIngredients)
    ? rawIngredients
    : typeof rawIngredients === 'string'
    ? rawIngredients.split(',').map((item: string) => item.trim()).filter(Boolean)
    : [];

  const triggerAddIngredient = () => {
    if (!ingredientInput.trim()) return;
    handleAddIngredient(ingredientInput.trim());
    setIngredientInput("");
  };

  const [assignmentDate, setAssignmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

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
              value={meal?.meal_name ?? ""}  
              onChange={(e) => meal && onUpdateMeal({ ...meal, meal_name: e.target.value })}
              placeholder="e.g., Lentil Stew" 
            />
          </div>
          <div className={styles.input_group}>
            <label>Target Calories (per serving)</label>
            <input 
              type="number" 
              value={meal?.calories_per_serving ?? ""} 
              onChange={(e) => meal && onUpdateMeal({ ...meal, calories_per_serving: Number(e.target.value) })}
            />
          </div>

          <div className={styles.metrics_dashboard}>
            <div className={styles.metric_card}>
              <span>Nutritional Score</span>
              <strong>{meal?.nutritional_score ?? "--"}</strong>
            </div>
            <div className={styles.metric_card}>
              <span>Status</span>
              <strong>{meal?.status ?? "--"}</strong>
            </div>
          </div>

          <section className={styles.ingredients_section}>
            <h3>Ingredients List</h3>
            <ul className={styles.ingredients_list}>
              {ingredientList.map((ing: string, i: number) => (
                <li key={`${ing}-${i}`} className={styles.ingredient_item}>
                  <span>{ing}</span>
                  <button 
                    type="button"
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
                    e.preventDefault();
                    triggerAddIngredient();
                  }
                }} 
              />
              <button 
                type="button"
                className={styles.add_ing_btn} 
                onClick={triggerAddIngredient}
              >
                +
              </button>
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
              <button 
                type="button"
                className={styles.run_scenario_btn} 
                onClick={onSendMessage}
              >
                Run Optimization
              </button>
            </div>
          </div>

          <div className={styles.action_footer}>
            <button className={styles.save_draft_btn} onClick={onSaveDraft}>
              Save
            </button>

            <button 
              type="button"
              className={styles.assign_btn}
              onClick={() => setIsModalOpen(true)}
              disabled={!meal}
              style={{ opacity: meal ? 1 : 0.5, cursor: meal ? 'pointer' : 'not-allowed' }}
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
            
            {!savedMealId && (
              <p style={{ color: '#d9534f', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Assigning will automatically save this meal to the database first.
              </p>
            )}

            <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
              <label 
                htmlFor="assignment-date" 
                style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem' }}
              >
                Assignment Date
              </label>
              <input 
                id="assignment-date"
                type="date" 
                value={assignmentDate} 
                onChange={(e) => setAssignmentDate(e.target.value)}
                style={{ 
                  width: '100%',
                  padding: '0.5rem', 
                  borderRadius: '4px', 
                  border: '1px solid #ccc',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {MOCK_CLIENTS && MOCK_CLIENTS.length > 0 ? (
                MOCK_CLIENTS.map((client: any) => (
                  <button 
                    key={client.client_id} 
                    onClick={() => handleAssignSubmit(client.client_id)}
                  >
                    Assign to <strong>{client.client_name || client.name}</strong>
                  </button>
                ))
              ) : (
                <p style={{ fontSize: '0.9rem', color: '#666' }}>No clients found in database.</p>
              )}
            </div>
            <button onClick={() => setIsModalOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

const AnimatedCalendarWrapper = ({ children }: { children: React.ReactNode }) => (
  <section className={`${styles.calendar_view} ${styles.animate_mount}`}>
    {children}
  </section>
);

function CalendarView({ meals }: CalendarViewProps) {
  type CalendarAssignments = Record<number, Record<string, string>>;

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedClientId, setSelectedClientId] = useState<number | null>(MOCK_CLIENTS[0]?.client_id || null);
  const [clients, setClients] = useState<Client[]>([]);
  const [calendarAssignments, setCalendarAssignments] = useState<CalendarAssignments>({});
  const [activeMenuDate, setActiveMenuDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const daysInMonth = (month: number, year: number): number => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();

  const fetchClientAssignments = async (clientId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/client/${clientId}/assignments`);
      if (!res.ok) throw new Error("Failed to fetch assignments");
      const data = await res.json();
      setAssignments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // fetch client list (maybe limit it to first ten or something)
  useEffect(() => {
      fetch('http://localhost:8000/api/clients')
        .then((res) => res.json())
        .then((data) => {
          setClients(data);
          if (data.length > 0) {
            setSelectedClientId(data[0].client_id);
          }
        })
        .catch((err) => console.error("Failed to load clients:", err));
    }, []);

    useEffect(() => {
      if (selectedClientId) {
        fetchClientAssignments(selectedClientId);
      }
    }, [selectedClientId]);

    const assignmentMap = useMemo(() => {
      const map: Record<string, string> = {};
      assignments.forEach((item) => {
        map[item.assignment_date] = item.meal.meal_name;
      });
      return map;
    }, [assignments]);
    
  const handleSelectSavedMeal = (day: number, meal: MealPlan): void => {
    if (selectedClientId === null) return;
    
    const month = String(calendarDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateKey = `${calendarDate.getFullYear()}-${month}-${d}`;

    setCalendarAssignments((prev) => ({
      ...prev,
      [selectedClientId]: {
        ...(prev[selectedClientId] || {}),
        [dateKey]: meal.meal_name, 
      },
    }));
    setActiveMenuDate(null);
  };

  const isDateLocked = (day: number): boolean => {
    const cellDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return cellDate < today;
  };

  // add handler for pushing meals
  return (
    <AnimatedCalendarWrapper>
      <header className={styles.calendar_header}>
        <div className={styles.client_picker}>
          <label>Assigning for: </label>
          <select 
            value={selectedClientId || ''} 
            onChange={(e) => setSelectedClientId(Number(e.target.value))}
          >
            {clients.map((c: any) => (
              <option key={c.client_id} value={c.client_id}>
                {c.client_name || c.name}
              </option>
            ))}
          </select>
        </div>
            
        <div className={styles.month_nav}>
          <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}>
            &lt; Prev
          </button>
          <h2>{calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
          <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}>
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
          
          // 1. Check local state edits first
          const localMeal = selectedClientId ? calendarAssignments[selectedClientId]?.[dateKey] : null;

          // 2. Fallback to live backend assignment for this date
          const backendMeal = assignments.find(a => a.assignment_date === dateKey)?.meal?.meal_name;

          // 3. Display local edit if present, otherwise backend assignment
          const assignedMeal = localMeal || backendMeal;
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
                    {meals && meals.length > 0 ? (
                      meals.map((meal: any) => (
                        <div 
                          key={meal.meal_id} 
                          className={styles.dummy_menu_item}
                          onClick={(e) => { e.stopPropagation(); handleSelectSavedMeal(day, meal); }}
                        >
                          {meal.meal_name}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
                        No saved meals available
                      </div>
                    )}
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

function SavedView({ meals, onEdit, onBack }: SavedViewProps) {
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
            <p><strong>{meal.calories_per_serving} kcal</strong> | {meal.status}</p>
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