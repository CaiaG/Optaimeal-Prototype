import styles from './PageClient.module.css';
import { useState } from 'react';
import {type MealPlan, type MealIngredient, parseIngredients, type MealCandidateOption, type ApplySelectionResponse } from './types/frontendSchemas';
import { apiFetch } from '../services/api';

interface ChatViewProps {
  assignments: MealPlan[];
  selectedDay: string;
  onDaySelect: (day: string) => void;
  unavailable: string[]; //
  onToggleIngredient: any;
  clientId: number | null; 
  numStudents: number | string;
  onMealUpdated: (newMeal: any) => void; 
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  candidateOptions: Record<string, any[]>;
  setCandidateOptions: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
}


interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
}

type AvailabilityStatus = 'available' | 'insufficient' | 'unavailable';

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
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [candidateOptions, setCandidateOptions] = useState<Record<string, any[]>>({});

  // Safely find the current meal with Array.isArray guard
  const currentMeal = Array.isArray(weeklyAssignment)
    ? weeklyAssignment.find(m => m.assignment_date === selectedDay)
    : null;

  // update count
  

  const buildFullWeekSchedule = (rawAssignments: any[]) => {
    const now = new Date();
    
    // Zero out time components to prevent DST / hour rollover issues
    now.setHours(0, 0, 0, 0);

    const currentDayOfWeek = now.getDay();

    // Calculate Monday's date for the current week
    const distanceToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMon);

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Handle null/undefined input safely
    const assignmentsArray = Array.isArray(rawAssignments)
      ? rawAssignments
      : rawAssignments
      ? [rawAssignments]
      : [];

    return dayNames.map((dayName, index) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + index);

      // Format date reliably as YYYY-MM-DD in LOCAL time (prevents UTC date shift)
      const dateKey = dayDate.toLocaleDateString('en-CA');

      // Match assignment against dateKey or dayName (handles ISO timestamps like "2026-08-10T00:00:00")
      const existing = assignmentsArray.find((item) => {
        if (!item) return false;
        const itemDateStr = typeof item.assignment_date === 'string' 
          ? item.assignment_date.split('T')[0] 
          : item.assignment_date;

        return itemDateStr === dateKey || item.assignment_date === dayName;
      });

      if (existing) {
        const mealDetails = existing.meal || existing;

        return {
          ...existing,
          ...mealDetails, // Flattens meal_name, status, ingredients to top level
          assignment_date: dateKey,
          day_name: dayName,
          isAssigned: true,
          meal: {
            ...mealDetails,
            assignment_date: dateKey,
          },
        };
      }

      // Blank placeholder for unassigned days
      return {
        assignment_date: dateKey,
        day_name: dayName,
        meal_id: null,
        meal_name: 'No Meal Assigned',
        status: 'Unassigned',
        calories_per_serving: 0,
        price_per_serving: 0,
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
    if (!inputClientId || Number.isNaN(parsedId) || parsedId <= 0) {
      setClientError('Please enter a valid numeric Client ID');
      return;
    }

    setIsSubmitting(true);

    try {
      // const data = await apiFetch<any>(`/api/client/${parsedId}/assignments`);
      const data = await apiFetch<any>(`/api/client/${parsedId}/assignments/week`);

      if (data.client?.population != null) {
        setNumStudents(data.client.population);
      }

      const assignmentsList = Array.isArray(data.assignments) ? data.assignments : [];
      const fullWeek = buildFullWeekSchedule(assignmentsList);
      setWeeklyAssignment(fullWeek);

      if (fullWeek.length > 0) {
        // Use local date string matching buildFullWeekSchedule ('YYYY-MM-DD')
        const todayKey = new Date().toLocaleDateString('en-CA');
        const todayMatch = fullWeek.find((d) => d.assignment_date === todayKey);
        
        setSelectedDay(todayMatch ? todayMatch.assignment_date : fullWeek[0].assignment_date);
      }

      setClientId(parsedId);
      setIsClientModalOpen(false);
    } catch (err: any) {
      console.error("Error fetching menu:", err);
      setClientError(err?.message || 'Client ID not found. Please check and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMealUpdated = (newMeal: any) => {
   
    setWeeklyAssignment((prevWeek) =>
      prevWeek.map((assignment) => {
        if (assignment.assignment_date === selectedDay) {
          return {
            ...assignment,
            ...newMeal,          
            meal_id: newMeal.meal_id,
            isAssigned: true,
            meal: {
              ...newMeal,
              assignment_date: assignment.assignment_date
            }, 
          };
        }
        return assignment;
      })
    );
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
          clientId={clientId}
          numStudents={numStudents}
          onMealUpdated={handleMealUpdated}
          chatHistories={chatHistories}
          setChatHistories={setChatHistories}
          candidateOptions={candidateOptions}
          setCandidateOptions={setCandidateOptions}
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
                    const baseQty = ing.ingredient_quantity ?? 1;
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

  function ChatView({ assignments = [], selectedDay, onDaySelect, clientId, numStudents = 1, onMealUpdated, setChatHistories, chatHistories,candidateOptions,       // <-- ADD THIS
  setCandidateOptions }: ChatViewProps) {
    const [chatInput, setChatInput] = useState('');
    const [availabilityMap, setAvailabilityMap] = useState<Record<string, Record<string | number, AvailabilityStatus>>>({});
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isApplyingSelection, setIsApplyingSelection] = useState(false);
    const dayKey = selectedDay ? String(selectedDay) : '';
    const [isSendingChat, setIsSendingChat] = useState(false);

    // Derived Active States
    const activeHistory = dayKey
      ? chatHistories[dayKey] || [
          { id: 'init', sender: 'assistant', text: `Chat ready for ${dayKey}.`, timestamp: new Date() }
        ]
      : [];

    const activeAvailabilityMap = dayKey ? (availabilityMap[dayKey] || {}) : {};
    const activeCandidateOptions = dayKey ? (candidateOptions[dayKey] || []) : [];

    const currentAssignment = assignments.find(
      (m) => String(m.assignment_date) === String(selectedDay)
    );

    const currentMeal = (currentAssignment && 'meal' in currentAssignment)
      ? (currentAssignment as any).meal
      : currentAssignment;

    const rawIngredients = 
      typeof currentMeal === 'object' && currentMeal !== null && 'ingredients' in currentMeal
        ? currentMeal.ingredients
        : undefined;

    const ingredientList = parseIngredients(rawIngredients);
    
    // Safe helper to append messages without stale closure bugs
    const appendMessage = (msg: ChatMessage) => {
      if (!dayKey) return;
      setChatHistories((prev) => {
        const currentDayHistory = prev[dayKey] || [
          { id: 'init', sender: 'assistant', text: `Chat ready for ${dayKey}.`, timestamp: new Date() }
        ];
        return {
          ...prev,
          [dayKey]: [...currentDayHistory, msg]
        };
      });
    };

    const handleSendMessage = async () => {
      if (!chatInput.trim() || !selectedDay || isSendingChat) return;

      const userText = chatInput.trim();
      setChatInput('');

      // append User message to UI
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: 'user',
        text: userText,
        timestamp: new Date(),
      };
      appendMessage(userMsg);

      setIsSendingChat(true);

      // Normalize date string (YYYY-MM-DD)
      const dayKey = typeof selectedDay === 'string'
        ? selectedDay
        : (selectedDay as Date).toISOString().split('T')[0];

      try {
        // Fetch AI response from FastAPI backend
        const data = await apiFetch<{ response: string }>('/api/client/menu/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            assignment_date: dayKey,
            message: userText,
          }),
        });

        // Append Groq assistant response
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: data.response,
          timestamp: new Date(),
        };
        appendMessage(assistantMsg);

      } catch (err: any) {
        appendMessage({
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: `Sorry, I ran into an error getting a response: ${err.message || 'Server error'}`,
          timestamp: new Date(),
        });
      } finally {
        setIsSendingChat(false);
      }
    };

    const handleReset = () => {
      if (!dayKey) return; 

      setChatHistories(prev => ({
        ...prev,
        [dayKey]: [{ id: Date.now().toString(), sender: 'system', text: "Chat reset for this meal.", timestamp: new Date() }]
      }));

      setAvailabilityMap(prev => ({
        ...prev,
        [dayKey]: {} 
      }));

      setCandidateOptions(prev => ({
        ...prev,
        [dayKey]: []
      }));

      setChatInput('');
    };

    const handleCycleAvailability = (key: string | number) => {
      if (!dayKey) return; 

      setAvailabilityMap((prev) => {
        const currentDayMap = prev[dayKey] || {}; 
        const currentStatus = currentDayMap[key] || 'available';
        
        const nextStatus: AvailabilityStatus =
          currentStatus === 'available'
            ? 'insufficient'
            : currentStatus === 'insufficient'
            ? 'unavailable'
            : 'available';

        return {
          ...prev,
          [dayKey]: { ...currentDayMap, [key]: nextStatus } 
        };
      });
    };

    const handleRegenerateMeal = async (userChatMessage?: string) => {
      if (!selectedDay || !currentMeal) return;
      setIsRegenerating(true);

      // Guarantee consistent key format
      const currentDayKey = String(selectedDay);

      const ingredientConstraints = ingredientList
        .map((ing: any) => {
          const isObject = typeof ing === 'object' && ing !== null;
          const ingName = isObject ? ing.ingredient_name : ing;
          const ingKey = isObject ? (ing.ingredient_id ?? ingName) : ingName;
          const status = activeAvailabilityMap[ingKey] || 'available';

          return { ingredient_name: ingName, status };
        })
        .filter((item: any) => item.status !== 'available');

      const unavailable = ingredientConstraints
        .filter((i: any) => i.status === 'unavailable')
        .map((i: any) => i.ingredient_name);

      const insufficient = ingredientConstraints
        .filter((i: any) => i.status === 'insufficient')
        .map((i: any) => i.ingredient_name);

      const constraintSummary = [
        unavailable.length ? `Missing: ${unavailable.join(', ')}` : null,
        insufficient.length ? `Low stock: ${insufficient.join(', ')}` : null,
      ].filter(Boolean).join(' | ');

      const chatContext = activeHistory
        .filter(msg => msg.sender === 'user' || msg.sender === 'assistant')
        .map(msg => ({
          role: msg.sender,
          content: msg.text
        }));

      const promptText = userChatMessage || 
        `Please regenerate "${currentMeal?.meal_name}" given these constraints: ${constraintSummary || 'No specific ingredient limits'}.`;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: 'user',
        text: promptText,
        timestamp: new Date(),
      };
      
      appendMessage(userMsg);

      const payload = {
        client_id: clientId,                 
        assignment_date: selectedDay,        
        meal_id: currentMeal?.meal_id,
        current_meal_name: currentMeal?.meal_name,
        servings: Number(numStudents) || 1, 
        unavailable_ingredients: unavailable,
        insufficient_ingredients: insufficient,
        user_prompt: promptText, 
        chat_history: chatContext, 
      };

      try {
        const rawResponse = await apiFetch<any>('/api/chat/regenerate-meal', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        console.log('Regenerate API Raw Response:', rawResponse);

        // Unwrap response if wrapped inside .data
        const response = rawResponse?.data || rawResponse || {};

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: response.reply || 'Here are some regenerated options for you:',
          timestamp: new Date(),
        };
        
        appendMessage(assistantMsg);

        // Extract meals from any supported property key
        const primaryEditedMeal = response.edited_meal || response.meal || response.assigned_meal;
        const additionalAlternatives = Array.isArray(response.alternatives) ? response.alternatives : [];

        const rawList: any[] = [];
        if (primaryEditedMeal) {
          rawList.push({ ...primaryEditedMeal, is_edited_original: true });
        }
        if (additionalAlternatives.length > 0) {
          rawList.push(...additionalAlternatives);
        }

        // Standardize object structure
        const formattedCandidates = rawList.map((alt: any) => {
          const mealData = alt.meal || alt;
          return {
            ...mealData,
            meal_name: mealData.meal_name || mealData.name || 'Suggested Option',
            assignment_date: selectedDay,
            is_edited_original: alt.is_edited_original ?? mealData.is_edited_original ?? false,
          };
        });

        // console.log('Formatted Candidates to Save:', formattedCandidates);

        if (formattedCandidates.length > 0) {
          setCandidateOptions((prev) => ({
            ...prev,
            [currentDayKey]: formattedCandidates,
          }));
        }

        setAvailabilityMap((prev) => ({ ...prev, [currentDayKey]: {} }));

      } catch (err: any) {
        appendMessage({
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: `Error regenerating meal: ${err.message}`,
          timestamp: new Date(),
        });
      } finally {
        setIsRegenerating(false);
      }
    };

    const handleApplySelection = async (selectedOption: MealCandidateOption) => {
      if (!selectedDay || !clientId) return;

      setIsApplyingSelection(true);
      
      // Ensure dayKey matches the date string format used in state keys ('YYYY-MM-DD')
      const dayKey = typeof selectedDay === 'string' 
        ? selectedDay 
        : (selectedDay as Date).toISOString().split('T')[0];

      const payload = {
        client_id: clientId,
        assignment_date: dayKey,
        selected_meal: {
          meal_id: selectedOption.meal_id,
          meal_name: selectedOption.meal_name,
          calories_per_serving: selectedOption.calories_per_serving,
          nutritional_score: selectedOption.nutritional_score,
          ingredients: selectedOption.ingredients || [],
          is_edited_original: Boolean(selectedOption.is_edited_original),
          is_alternative: Boolean(selectedOption.is_alternative),
        },
      };

      try {
        const response = await apiFetch<ApplySelectionResponse>(
          '/api/client/menu/apply-selection',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        // Update top-level week state with the eager-loaded, database-persisted meal
        if (onMealUpdated && response.assigned_meal) {
          onMealUpdated(response.assigned_meal);
        }

        // Clear candidate cards and low-stock flags for this specific day
        setCandidateOptions((prev) => ({ ...prev, [dayKey]: [] }));
        setAvailabilityMap((prev) => ({ ...prev, [dayKey]: {} }));

        // Confirm action in chat stream
        appendMessage({
          id: Date.now().toString(),
          sender: 'system',
          text: `Successfully assigned "${response.assigned_meal?.meal_name || selectedOption.meal_name}" to ${dayKey}.`,
          timestamp: new Date(),
        });

      } catch (err: any) {
        console.error("Error applying selection:", err);
        appendMessage({
          id: Date.now().toString(),
          sender: 'assistant',
          text: `Failed to update meal assignment: ${err.message || 'Server error'}`,
          timestamp: new Date(),
        });
      } finally {
        setIsApplyingSelection(false);
      }
    };

    return (
      <div className={styles.chat_wrapper}>
        {/* Left Column: Chat Window */}
        <div className={styles.chat_container}>
          <header className={styles.chat_header}>
            <h2>Chat</h2>
            <button className={styles.reset_chat_btn} onClick={handleReset}>Reset</button>
          </header>

          <div className={styles.chat_window}>
            {activeHistory.map((msg, index) => {
              const isUser = msg.sender === 'user';
              const senderLabel = isUser ? 'User' : msg.sender === 'assistant' ? 'Assistant' : 'System';

              return (
                <div key={msg.id || index} className={isUser ? styles.user_msg : styles.system_msg}>
                  <p><strong>{senderLabel}:</strong> {msg.text}</p>
                </div>
              );
            })}

            {activeCandidateOptions.length > 0 && (
              <section className={styles.options_container}>
                <h4 className={styles.options_title}>Suggested Options</h4>
                <p className={styles.options_subtitle}>
                  Select an option below to override current meal assignment:
                </p>

                <div className={styles.options_scroll_row}>
                  {activeCandidateOptions.map((option, idx) => {
                    const ingredients = Array.isArray(option.ingredients) ? option.ingredients : [];

                    // Normalize ingredients array to simple strings before sending to handler
                    const handleSelect = () => {
                      const normalizedOption = {
                        ...option,
                        ingredients: ingredients.map((ing: any) => {
                          if (typeof ing === 'object' && ing !== null) {
                            return {
                              ingredient_name: ing.ingredient_name || ing.name,
                              ingredient_quantity: ing.ingredient_quantity ?? ing.quantity ?? 1.0,
                              unit: ing.unit || 'unit',
                            };
                          }
                          return {
                            ingredient_name: ing,
                            ingredient_quantity: 1.0,
                            unit: 'unit',
                          };
                        }),
                      };
                      handleApplySelection(normalizedOption);
                    };

                    return (
                      <div 
                        key={option.meal_id ? `${option.meal_id}-${idx}` : idx}
                        className={`${styles.option_card} ${option.is_edited_original ? styles.option_card_adjusted : ''}`}
                      >
                        <div>
                          {/* Header */}
                          <div className={styles.card_header}>
                            <div className={styles.card_title}>{option.meal_name}</div>
                            {option.is_edited_original && (
                              <span className={styles.adjusted_badge}>Adjusted</span>
                            )}
                          </div>

                          {/* Nutrition & Servings */}
                          <div className={styles.nutrition_info}>
                            <strong>{option.calories_per_serving ?? 'N/A'}</strong> kcal &bull; 
                            Score: <strong>{option.nutritional_score ?? 'N/A'}</strong> &bull; 
                            Servings: <strong>{numStudents}</strong>
                          </div>

                          {/* Ingredients */}
                          {ingredients.length > 0 && (
                            <div>
                              <div className={styles.section_label}>Ingredients ({ingredients.length})</div>
                              <div className={styles.ingredients_box}>
                                <ul className={styles.ingredients_list}>
                                  {ingredients.map((ing: any, i: number) => {
                                    const isObj = typeof ing === 'object' && ing !== null;
                                    const name = isObj ? (ing.ingredient_name || ing.name) : ing;
                                    
                                    // Uses ingredient_quantity with a safe fallback to quantity
                                    const rawQty = isObj ? (ing.ingredient_quantity ?? ing.quantity) : null;
                                    const qty = rawQty !== null && rawQty !== undefined 
                                      ? `${rawQty}${ing.unit && ing.unit !== 'unit' ? ' ' + ing.unit : ''}` 
                                      : null;
                                      
                                    const status = isObj ? ing.status : null;

                                    return (
                                      <li key={i} className={styles.ingredient_item}>
                                        {name} {qty && <span className={styles.ingredient_quantity}>({qty})</span>}
                                        {status && status !== 'available' && (
                                          <span className={status === 'substituted' ? styles.status_substituted : styles.status_alert}>
                                            [{status}]
                                          </span>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Select Button */}
                        <button
                          onClick={handleSelect}
                          disabled={isApplyingSelection}
                          className={styles.select_button}
                        >
                          {isApplyingSelection ? 'Applying...' : 'Select This Meal'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
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
            <button className={styles.send_btn} onClick={handleSendMessage} disabled={isRegenerating}>
              {isRegenerating ? 'Sending...' : 'Send'}
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
                  <p><strong>Target Servings:</strong> {numStudents || 1}</p>
                </div>

                <section className={styles.ingredients}>
                  <h3>Ingredients Overview</h3>
                  <p><small>Click items to toggle availability: <strong>[ ] Available</strong> &rarr; <strong>[!] Insufficient</strong> &rarr; <strong>[X] Out of Stock</strong></small></p>

                  {ingredientList.length > 0 ? (
                    ingredientList.map((ing: MealIngredient | string, i: number) => {
                      const isObject = typeof ing === 'object' && ing !== null;
                      const ingName = isObject ? ing.ingredient_name : ing;
                      const ingKey = isObject ? (ing.ingredient_id ?? ingName) : ingName;

                      const perServingQty = isObject ? (ing.ingredient_quantity ?? 1) : 1;
                      const totalQty = perServingQty * (Number(numStudents) || 1);
                      const unit = isObject ? (ing.unit ?? '') : '';

                      const status = activeAvailabilityMap[ingKey] || 'available';

                      let statusBadge = '[  ]';
                      let itemStyle: React.CSSProperties = {
                        cursor: 'pointer',
                        marginBottom: '0.6rem',
                        userSelect: 'none',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s',
                      };

                      if (status === 'insufficient') {
                        statusBadge = '[ ! ]';
                        itemStyle = {
                          ...itemStyle,
                          color: '#d97706',
                          backgroundColor: '#fef3c7',
                          fontWeight: 500,
                        };
                      } else if (status === 'unavailable') {
                        statusBadge = '[ X ]';
                        itemStyle = {
                          ...itemStyle,
                          color: '#ef4444',
                          textDecoration: 'line-through',
                          backgroundColor: '#fee2e2',
                        };
                      }

                      return (
                        <div
                          key={`${ingKey}-${i}`}
                          onClick={() => handleCycleAvailability(ingKey)}
                          style={itemStyle}
                        >
                          <span><strong>{statusBadge}</strong> {ingName}</span>
                          <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: '0.1rem' }}>
                            {perServingQty} {unit} / serving &bull; <strong>{totalQty} {unit} total</strong>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>No ingredients listed.</p>
                  )}
                </section>

                <button
                  className={styles.regenerate_btn}
                  onClick={() => handleRegenerateMeal()}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? 'Regenerating Meal...' : 'Regenerate Meal with Constraints'}
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
