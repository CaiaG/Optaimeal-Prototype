import styles from './PageClient.module.css';
import { useState, useEffect } from 'react';
import { createEmptyMeal, type MealPlan, type MealIngredient } from './types/mealplan';

export const parseIngredients = (
  ingredients: MealIngredient[] | string[] | string | undefined | null
): MealIngredient[] => {
  if (!ingredients) return [];

  let raw: any[] = [];

  // 1. Parse string inputs (JSON stringified array OR comma-separated string)
  if (typeof ingredients === 'string') {
    const trimmed = ingredients.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        raw = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Fallback to CSV split if JSON parsing fails
        raw = trimmed.split(',').map((s) => s.trim());
      }
    } else {
      raw = trimmed.split(',').map((s) => s.trim());
    }
  } else if (Array.isArray(ingredients)) {
    raw = ingredients;
  }

  // 2. Normalize every item into a valid MealIngredient object
  return raw
    .map((item, index) => {
      if (!item) return null;

      // Already structured MealIngredient object
      if (typeof item === 'object') {
        return {
          ingredient_id: item.ingredient_id ?? index + 1,
          ingredient_name: item.ingredient_name || item.name || 'Unknown Ingredient',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || 'unit',
        };
      }

      // Legacy string element (e.g., "Lentils")
      if (typeof item === 'string') {
        const str = item.trim();
        if (!str) return null;

        return {
          ingredient_id: index + 1,
          ingredient_name: str,
          quantity: 1,
          unit: 'unit',
        };
      }

      return null;
    })
    .filter((item): item is MealIngredient => item !== null);
};

interface ChatViewProps {
  assignments: MealPlan[];
  selectedDay: string;
  onDaySelect: (day: string) => void;
  unavailable: string[]; //
  onToggleIngredient: any;
}

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
        {activeView === 'main' && (
          currentMeal ? (
            <MainView 
              meal={currentMeal.meal || currentMeal} 
              unavailable={unavailableIngredients} 
              onToggleIngredient={setUnavailableIngredients} 
            />
          ) : (
            <div className={styles.empty_view_state}>
              <h3>No Meal Selected</h3>
              <p>Select a day from the sidebar to view scheduled meal details.</p>
            </div>
          )
        )}

        {activeView === 'chat' && (
          <ChatView 
            assignments={weeklyAssignment} 
            selectedDay={selectedDay} 
            onDaySelect={setSelectedDay}
            unavailable={unavailableIngredients} 
            onToggleIngredient={setUnavailableIngredients} 
          />
        )}

        {activeView === 'calendar' && (
          <div className={styles.view_card}>
            <h2>Weekly Calendar View</h2>
            <p className={styles.placeholder_text}>Calendar component coming soon.</p>
          </div>
        )}
      </main>
    </div>
  );


  function Sidebar({ assignments, selectedDay, onDaySelect, onViewChange }: any) {
    return (

      <div className={styles.sidebar_wrapper}>
        {/* Header banner displaying the active Client ID */}
        {clientId && (
          <div className={styles.client_header_bar}>
            <span className={styles.client_id_badge}>
              Client ID: <strong>#{clientId}</strong>
            </span>
            <button 
              className={styles.change_client_btn}
              onClick={() => setIsClientModalOpen(true)}
            >
              Switch Client
            </button>
          </div>
        )}
        
        <nav className={styles.top_sidebar}>
          {['main', 'chat', 'calendar'].map((view) => {
            const isActive = activeView === view;
            return (
              <button 
                key={view} 
                onClick={() => onViewChange(view)}
                className={`${styles.top_sidebar_btn} ${isActive ? styles.active : ''}`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            );
          })}
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

  function MainView({ meal}: any) {
    
    const ingredientsList = parseIngredients(meal?.ingredients);

    return (
      <div className={styles.meal_details_view}>
         <div className={styles.meal_details_card}>
        {/* Header */}
        <div className={styles.header_section}>
          <span className={styles.date_badge}>Monday, Aug 3, 2026</span>
          <h2 className={styles.meal_title}>
            {meal?.meal_name || "No Meal Assigned"}
          </h2>
        </div>

        {/* Stats Grid */}
        <div className={styles.stats_box}>
          <div className={styles.stat_item}>
            <span className={styles.stat_label}>CALORIES / SERVING</span>
            <div className={styles.stat_value_container}>
              <span className={styles.stat_value}>{meal?.calories_per_serving ?? 0}</span>
              <span className={styles.stat_unit}>kcal</span>
            </div>
          </div>

          <div className={styles.stat_item}>
            <span className={styles.stat_label}>NUTRITIONAL SCORE</span>
            <div className={styles.stat_value_container}>
              <span className={styles.stat_value}>{meal?.nutritional_score ?? 0}</span>
              <span className={styles.stat_unit}>/ 10</span>
            </div>
          </div>
        </div>

        {/* Student Count / Servings Bar */}
        <div className={styles.quantity_section}>
          <section className={styles.quantity_section}>
            <label>Nr of students: </label>
            <input type="number" placeholder="q" />
          </section>
        </div>

        {/* Ingredients Empty / Active State */}
        <div className={styles.ingredients_list}>
          <h4>Ingredients</h4>
            <ul>
              {ingredientsList.length > 0 ? (
              ingredientsList.map((ing: MealIngredient | string, index: number) => {
              const isObject = typeof ing === 'object' && ing !== null;
              const key = isObject && ing.ingredient_id ? `${ing.ingredient_id}-${index}` : index;
              const displayText = isObject
              ? `${ing.quantity ?? 1} ${ing.unit ?? ''} ${ing.ingredient_name}`.trim()
              : ing;

              return <li key={key}>{displayText}</li>;
              })
              ) : (
              <li>No ingredients listed</li>
              )}
            </ul>
          </div>
        </div>    
      </div>

      
    );
  }

function ChatView({ assignments, selectedDay, onDaySelect, unavailable, onToggleIngredient }: ChatViewProps) {    const [chatInput, setChatInput] = useState('');
    const [history, setHistory] = useState([{ sender: 'System', text: "Start chat" }]);
    
    const toggle = (ing: string) => {
      onToggleIngredient((prev: string[]) => 
        prev.includes(ing) ? prev.filter(i => i !== ing) : [...prev, ing]
      );
    };

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

                      

                      <section className={styles.ingredients}>
                    <h3>Ingredients Checklist</h3>
                    <p><small>Mark unavailable items with an [X]</small></p>
                    
                    {ingredientList.length > 0 ? (
                      ingredientList.map((ing: MealIngredient | string, i: number) => {
                        // Extract name and display string safely (handles structured objects and legacy strings)
                        const isObject = typeof ing === 'object' && ing !== null;
                        const ingName = isObject ? ing.ingredient_name : ing;
                        const ingId = isObject ? ing.ingredient_id : i;
                        
                        const displayText = isObject
                          ? `${ing.quantity ?? 1} ${ing.unit ?? ''} ${ing.ingredient_name}`.trim()
                          : ing;

                        // Check if ingredient name or ID is marked unavailable
                        const isUnavailable = unavailable.includes(ingName) || unavailable.includes(ingId as any);

                        return (
                          <div 
                            key={`${ingId}-${i}`} 
                            onClick={() => toggle(ingName)}
                            style={{ 
                              cursor: 'pointer', 
                              textDecoration: isUnavailable ? 'line-through' : 'none',
                              color: isUnavailable ? 'red' : 'inherit',
                              marginBottom: '0.5rem'
                            }}
                          >
                            [{isUnavailable ? 'X' : ' '}] {displayText}
                          </div>
                        );
                      })
                    ) : (
                      <p style={{ color: '#888', fontStyle: 'italic' }}>No ingredients listed.</p>
                    )}
                  </section>

                    </section>
                    <button
                      className={styles.regenerate_btn}
                      onClick={() => alert("Regenerate logic should be handled here or passed as a prop")}
                    >
                      Regenerate Meal
                    </button>
                  </div>
              </div>
      </div>
    );
  }
}