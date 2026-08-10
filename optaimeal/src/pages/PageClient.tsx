import styles from './PageClient.module.css';
import { useState, useEffect } from 'react';
import {type MealPlan, type MealIngredient, parseIngredients } from './types/mealplan';
import { apiFetch } from '../services/api';

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
  const [numStudents, setNumStudents] = useState<number | string>(1);
  const [clientError, setClientError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Safely find the current meal with Array.isArray guard
  const currentMeal = Array.isArray(weeklyAssignment)
    ? weeklyAssignment.find(m => m.assignment_date === selectedDay)
    : null;

  // update count
  

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
        const mealDetails = existing.meal || existing;

        return {
          ...existing,
          ...mealDetails, // Flattens meal_name, status, ingredients to top level
          assignment_date: dateKey,
          day_name: dayName,
          isAssigned: true,
          // Keeps nested .meal object populated for components expecting item.meal
          meal: {
            ...mealDetails,
            assignment_date: dateKey,
          },
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
        ingredients: [],
        isAssigned: false,
      };
    });
  };

  const handleClientSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setClientError('');

    const parsedId = Number(inputClientId);
    if (!parsedId || isNaN(parsedId)) {
      setClientError('Please enter a valid numeric Client ID');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await apiFetch<any>(`/api/client/${parsedId}/assignments`);

      if (data.client?.population != null) {
        setNumStudents(data.client.population);
      }

      const assignmentsList = Array.isArray(data.assignments) ? data.assignments : [];
      const fullWeek = buildFullWeekSchedule(assignmentsList);
      setWeeklyAssignment(fullWeek);

      if (fullWeek.length > 0) {
        const todayKey = new Date().toISOString().split('T')[0];
        const todayMatch = fullWeek.find((d) => d.assignment_date === todayKey);
        setSelectedDay(todayMatch ? todayMatch.assignment_date : fullWeek[0].assignment_date);
      }

      setClientId(parsedId);
      setIsClientModalOpen(false);
    } catch (err: any) {
      console.error("Error fetching menu:", err);
      setClientError('Client ID not found. Please check and try again.');
    } finally {
      setIsSubmitting(false);
    }
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
                onChange={(e) => {
                  setInputClientId(e.target.value);
                  if (clientError) setClientError(''); // Clear error on typing
                }}
                autoFocus
                required
                className={styles.client_input}
              />

              {/* Display Error Message */}
              {clientError && (
                <p className={styles.error_message} style={{ color: '#e53e3e', marginTop: '8px', fontSize: '14px' }}>
                  {clientError}
                </p>
              )}

              <div className={styles.modal_actions}>
                <button 
                  type="submit" 
                  className={styles.submit_button}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Verifying...' : 'View Menu'}
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

  function MainView({ meal}: any) {
    
    const ingredientsList = parseIngredients(meal?.ingredients);

    
    return (
      <div className={styles.meal_details_view}>
         <div className={styles.meal_details_card}>
        {/* Header */}
        <div className={styles.header_section}>
          <span className={styles.date_badge}> {meal?.assignment_date} </span>
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
            <label htmlFor="student_count">Nr of students: </label>
            <input 
              id="student_count"
              type="number" 
              placeholder="Enter number..." 
              value={numStudents ?? 1}
              onChange={(e) => {
                const val = e.target.value;
                setNumStudents(val === '' ? '' : Math.max(1, parseInt(val, 10) || 0));
              }}
              onBlur={() => {
                if (numStudents === '' || Number(numStudents) < 1) {
                  setNumStudents(1);
                }
              }}
              min="1"
            />
          </div>

          {/* Ingredients List */}
          <div className={styles.ingredients_list}>
            <h4>Ingredients</h4>
            <ul>
              {ingredientsList.length > 0 ? (
                ingredientsList.map((ing: MealIngredient | string, index: number) => {
                  const isObject = typeof ing === 'object' && ing !== null;
                  const key = isObject && ing.ingredient_id ? `${ing.ingredient_id}-${index}` : index;

                  // Fall back to 1 if numStudents is empty or 0
                  const multiplier = typeof numStudents === 'number' && numStudents > 0 ? numStudents : 1;

                  let displayText = '';

                  if (isObject) {
                    const baseQty = ing.quantity ?? 1;
                    // Scale quantity and round cleanly to max 2 decimal places (avoids floats like 0.30000000004)
                    const scaledQty = Number((baseQty * multiplier).toFixed(2));
                    const unitStr = ing.unit ? `${ing.unit} ` : '';
                    
                    displayText = `${scaledQty} ${unitStr}${ing.ingredient_name}`.trim();
                  } else {
                    displayText = ing;
                  }

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

  function ChatView({ assignments = [], selectedDay, onDaySelect, unavailable = [], onToggleIngredient }: ChatViewProps) {
    const [chatInput, setChatInput] = useState('');
    const [history, setHistory] = useState([{ sender: 'System', text: "Start chat" }]);

    const toggle = (ing: string) => {
      if (onToggleIngredient) {
        onToggleIngredient((prev: string[]) => 
          prev.includes(ing) ? prev.filter(i => i !== ing) : [...prev, ing]
        );
      }
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

    // 1. Safely find assignment (string casting prevents Date/string type mismatch)
    const currentAssignment = assignments.find(
      (m) => String(m.assignment_date) === String(selectedDay)
    );

    // Safe check using 'in' operator
    const currentMeal = (currentAssignment && 'meal' in currentAssignment)
      ? (currentAssignment as any).meal
      : currentAssignment;

    
    // 3. Safely parse ingredients list
    const rawIngredients = 
      typeof currentMeal === 'object' && currentMeal !== null && 'ingredients' in currentMeal
        ? currentMeal.ingredients
        : undefined;

    const ingredientList = parseIngredients(rawIngredients);

    return (
      <div className={styles.chat_wrapper}>
        {/* Left Column: Chat Window */}
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

        {/* Right Column: Meal Inspector & Ingredient Checklist */}
        <div className={styles.meal_selector_box}>
          <h3>Select Meal to Edit</h3>

          {/* Day / Meal Selector Bar */}
          <div className={styles.meal_btn_group}>
            {assignments.map((m: any) => {
              const isSelected = String(selectedDay) === String(m.assignment_date);
              const mealObj = m.meal || m;
              const buttonLabel = mealObj.meal_name || m.assignment_date;

              return (
                <button 
                  key={m.assignment_date} 
                  className={`${styles.chat_meal_btns} ${isSelected ? styles.active : ''}`}
                  onClick={() => onDaySelect(m.assignment_date)}
                >
                  {buttonLabel}
                </button>
              );
            })}
          </div>

          {/* Meal Detail Card */}
          <div className={styles.meal_card}>
            {currentMeal ? (
              <>
                <h3>{currentMeal.meal_name || "Untitled Meal"}</h3>

                <div className={styles.meta_info}>
                  <p><strong>Calories:</strong> {currentMeal.calories_per_serving ?? 'N/A'} kcal</p>
                  <p><strong>Nutritional Score:</strong> {currentMeal.nutritional_score ?? 'N/A'}</p>
                </div>

                <section className={styles.ingredients}>
                  <h3>Ingredients Per Serving</h3>
                  <p><small>Mark unavailable items with an [X]</small></p>

                  {ingredientList.length > 0 ? (
                    ingredientList.map((ing: MealIngredient | string, i: number) => {
                      const isObject = typeof ing === 'object' && ing !== null;
                      const ingName = isObject ? ing.ingredient_name : ing;
                      const ingId = isObject ? ing.ingredient_id : i;

                      const displayText = isObject
                        ? `${ing.quantity ?? 1} ${ing.unit ?? ''} ${ing.ingredient_name}`.trim()
                        : ing;

                      const isUnavailable = unavailable.includes(ingName) || unavailable.includes(ingId as any);

                      return (
                        <div 
                          key={`${ingId}-${i}`} 
                          onClick={() => toggle(ingName)}
                          style={{ 
                            cursor: 'pointer', 
                            textDecoration: isUnavailable ? 'line-through' : 'none',
                            color: isUnavailable ? '#ef4444' : 'inherit',
                            marginBottom: '0.5rem',
                            userSelect: 'none'
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

                <button
                  className={styles.regenerate_btn}
                  onClick={() => alert("Regenerate meal logic triggered")}
                >
                  Regenerate Meal
                </button>
              </>
            ) : (
              <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
                Select a meal above to view details.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
}