import React, { useState, useEffect, useRef } from 'react';
import styles from './PageOpp.module.css';
import { createEmptyMeal, type MealPlan, type Assignment, type Client, type MasterIngredient, 
  type MealIngredient, type CreateIngredientPayload, type AnalyticsEntry, type AnalyticsResponse, type AnalyticsSummary, type MealBreakdownResponse, type MealBreakdownTotals, type MealIngredientBreakdown} from './types/frontendSchemas';
import { apiFetch } from '../services/api';

// --- Types & Interfaces ---

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
  clients: Client[];
  isLoadingClients?: boolean;
  selectedClientId: number | null;
  setSelectedClientId: React.Dispatch<React.SetStateAction<number | null>>;
  availableIngredients: MasterIngredient[];
  onCreateNewIngredient: (name: string, unit: string) => Promise<MasterIngredient | null>;
}

interface CalendarViewProps {
  meals: MealPlan[];
  clients: Client[];
  isLoadingClients?: boolean;
  selectedClientId: number | null;
  setSelectedClientId: React.Dispatch<React.SetStateAction<number | null>>;
}

interface SavedViewProps {
  meals: MealPlan[];
  onEdit: (meal: MealPlan) => void;
  onBack: () => void;
}

interface AnalyticsViewProps {
  meals: MealPlan[];
  clients: Client[];
}


// --- Main Application Component ---
export default function PageOpp() {
  const [activeView, setActiveView] = useState('home');
  const [selectedMeal, setSelectedMeal] = useState<MealPlan | null>(null);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState<boolean>(true);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(clients[0]?.client_id || null);
  const [availableIngredients, setAvailableIngredients] = useState<MasterIngredient[]>([]);
  const [newLocation, setNewLocation] = useState('');
  const [newPopulation, setNewPopulation] = useState('');
// Shared Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'System', text: "Start chat" }
  ]);

  const [savedMealId, setSavedMealId] = useState<number | null>(null);
  const lastSavedPayloadRef = useRef<string | null>(null);
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Fetch Meals
      try {
        const mealsData = await apiFetch<MealPlan[]>('/api/meals');
        setMeals(mealsData);
      } catch (err) {
        console.error('Error fetching meals:', err);
        setMeals([]);
      }

      // 2. Fetch Clients
      try {
        const clientsData = await apiFetch<Client[]>('/api/clients');
        const normalized = clientsData.map((c) => ({
          ...c,
          client_name: c.client_name || `Client #${c.client_id}`,
        }));
        setClients(normalized);
      } catch (err) {
        console.error('Error fetching clients:', err);
      } finally {
        setIsLoadingClients(false);
      }

      // 3. Fetch Ingredients
      try {
        const data = await apiFetch<any>('/api/ingredients');
        const list = Array.isArray(data) ? data : data.ingredients || [];
        setAvailableIngredients(list);
      } catch (err) {
        console.error('Error fetching ingredients:', err);
        setAvailableIngredients([]);
      }
    };

    loadInitialData();
  }, []);

 const buildSavePayload = (meal: MealPlan) => {
    const sanitizedIngredients = (meal.ingredients || []).map((ing: any) => {
      if (typeof ing === 'string') {
        return {
          ingredient_id: null,
          ingredient_name: ing.trim(),
          ingredient_quantity: 1.0,
          unit: 'unit',
        };
      }
      const parsedQuantity = Number(ing.ingredient_quantity);
      return {
        ingredient_id: ing.ingredient_id ?? null,
        ingredient_name: ing.ingredient_name || ing.name || 'Unnamed Ingredient',
        ingredient_quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 1.0,
        unit: ing.unit || 'unit',
      };
    });
 
    return {
      meal_name: meal.meal_name || 'Untitled Meal',
      status: meal.status || 'Draft',
      calories_per_serving: Number(meal.calories_per_serving) || 0.0,
      nutritional_score: Number(meal.nutritional_score) || 0.0,
      price_per_serving: Number(meal.price_per_serving) || 0.0,
      ingredients: sanitizedIngredients,
    };
  };

  const payloadKey = (mealId: number | null, payload: ReturnType<typeof buildSavePayload>) => {
    
    const { status: _status, ...content } = payload;
    return JSON.stringify({ meal_id: mealId, content });
  };

  // --- Handlers ---
  const handleNavigation = (view: string, meal: MealPlan | null = null) => {
    if (view === 'generate' && !meal) {
      setSelectedMeal(createEmptyMeal());
      // Brand-new, unsaved meal - nothing to compare against yet.
      lastSavedPayloadRef.current = null;
    } else {
      setSelectedMeal(meal);
      // Loading an existing meal fresh from the server/list isn't a local
      // edit - seed the snapshot so handleSaveDraft doesn't treat merely
      // opening it for viewing as "dirty".
      lastSavedPayloadRef.current = meal
        ? payloadKey(meal.meal_id, buildSavePayload(meal))
        : null;
    }
    setActiveView(view);
  };

  const handleSendMessage = async () => {
    if (chatInput.trim() === '') return;

    const userMessageText = chatInput;
    const userMessage = { sender: 'User', text: userMessageText };
    
    // Optimistically update chat history with the user's message
    setChatHistory((prev) => [...prev, userMessage]);
    setChatInput('');

    try {
     
      const chatContext = chatHistory.map((msg) => ({
        role: msg.sender.toLowerCase() === 'user' ? 'user' : 'assistant',
        content: msg.text,
      }));

      // Construct payload using operator-side context variables available in your state
      const payload = {
        current_meal_name: selectedMeal?.meal_name || null,
        message: userMessageText,
        chat_history: chatContext,
      };

      // Call your backend endpoint using apiFetch
      const data = await apiFetch<any>('/api/operator/menu/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'System', 
          text: data.response || 'No response received from assistant.',
        },
      ]);

    } catch (error) {
      console.error('Error sending chat message:', error);
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'System',
          text: 'Sorry, I encountered an error connecting to the AI assistant. Please try again.',
        },
      ]);
    }
  };

  const handleResetChat = () => {
    if (!selectedMeal) return;
    setChatHistory([{ sender: 'System', text: "Yo" }]);
    setChatInput('');
  };

  
 // 1. Save Draft & Update Local Meals List
  const handleSaveAndUpdateFrontend = async () => {
    // handleSaveDraft returns the freshly saved MealPlan object directly
    const savedMeal = await handleSaveDraft();
    if (!savedMeal) return;

    setMeals((prevMeals) => {
      const existingIndex = prevMeals.findIndex(
        (m) => m.meal_id === savedMeal.meal_id
      );

      if (existingIndex >= 0) {
        const updatedMeals = [...prevMeals];
        updatedMeals[existingIndex] = savedMeal;
        return updatedMeals;
      }

      return [...prevMeals, savedMeal];
    });
  };

  // 2. Persist Meal Draft to Backend API
  const handleSaveDraft = async (
    showAlert = true
  ): Promise<MealPlan | null> => {
    if (!selectedMeal) return null;
 
    const isExistingMeal = Boolean(selectedMeal.meal_id);
    const endpoint = isExistingMeal
      ? `/api/meal/${selectedMeal.meal_id}`
      : '/api/meal';
 
    const method = isExistingMeal ? 'PUT' : 'POST';
 
    const payload = buildSavePayload(selectedMeal);
 
    // No-op guard: if this meal was already saved and nothing in the
    // payload has changed since, skip the network call entirely. Without
    // this, re-saving an unchanged Active meal with a Locked assignment
    // still forks it (see can_edit_meal_in_place) - there's no reason to
    // mint a new Meal row when the content is identical to what's already
    // persisted.
    const currentKey = payloadKey(selectedMeal.meal_id, payload);
    if (isExistingMeal && lastSavedPayloadRef.current === currentKey) {
      if (showAlert) {
        alert('No changes to save.');
      }
      return selectedMeal;
    }
 
    try {
      const savedMeal = await apiFetch<MealPlan>(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
 
      const assignedId = savedMeal.meal_id || selectedMeal.meal_id;
 
      const updatedMealState: MealPlan = {
        ...selectedMeal,
        ...savedMeal,
        meal_id: assignedId,
        ingredients: savedMeal.ingredients || payload.ingredients,
      };
 
      setSavedMealId(assignedId);
      setSelectedMeal(updatedMealState);
      lastSavedPayloadRef.current = payloadKey(assignedId, payload);
 
      if (showAlert) {
        alert('Draft saved successfully!');
      }
 
      return updatedMealState;
    } catch (e: any) {
      console.error('Save failed:', e);
      alert(`Failed to save draft: ${e.message}`);
      return null;
    }
  };

  // 3. Assign Meal to Client & Update Status
  const handleAssignToClient = async (clientId: number | null, date: string) => {
    if (!clientId) return;

    // change so meals can only be assigned to future WEEKS not days (do on front and back)
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (date <= todayStr) {
      alert('Meals can only be assigned to future dates.');
      return;
    }

    // 1. Only save/PUT when there's actually something new to persist:
    // either this meal has never been saved (no meal_id yet), or it's
    // still a Draft (so any edits made since the last save need to land).
    // Once a meal is 'Active' (already assigned somewhere), re-saving here
    // would hit update_meal's fork-on-edit path and mint a brand new Meal
    // row even though nothing changed - that's what was duplicating the
    // meal on every additional day assigned. Reuse the existing meal_id
    // directly instead.
    const needsSave = !selectedMeal?.meal_id || selectedMeal.status !== 'Active';
    const savedMeal = needsSave ? await handleSaveDraft(false) : selectedMeal;
    if (!savedMeal || !savedMeal.meal_id) return;

    const currentMealId = savedMeal.meal_id;

    try {
      const response = await apiFetch<{
        message: string;
        overwritten: boolean;
        assigned_meal_id: number;
        assignment_date: string;
        price_per_serving?: number;
      }>('/api/operator/menu/assign', {
        method: 'POST',
        body: JSON.stringify({
          meal_id: currentMealId,
          client_id: clientId,
          assignment_date: date,
          price_per_serving: Number(savedMeal.price_per_serving) || 0.0,
          status: 'Scheduled',
        }),
      });

      alert(response.message || 'Meal assigned successfully!');

      setSelectedMeal((prev) =>
        prev
          ? { ...prev, ...savedMeal, status: 'Active', assignment_date: date }
          : null
      );

      setMeals((prevMeals) => {
        const existingIndex = prevMeals.findIndex((m) => m.meal_id === currentMealId);
        const updatedMeal: MealPlan = {
          ...(existingIndex >= 0 ? prevMeals[existingIndex] : savedMeal),
          ...savedMeal,
          status: 'Active',
          assignment_date: date,
        };

        if (existingIndex >= 0) {
          const updatedMeals = [...prevMeals];
          updatedMeals[existingIndex] = updatedMeal;
          return updatedMeals;
        }

        return [...prevMeals, updatedMeal];
      });
    } catch (e: any) {
      console.error('Assignment failed:', e);
      alert(`Assignment failed: ${e.message}`);
    }
  };
  
  const handleCreateNewIngredient = async (
      input: string | CreateIngredientPayload
    ): Promise<MasterIngredient | null> => {
      // rn only passes name when create ingr
      const payload: CreateIngredientPayload =
        typeof input === 'string'
          ? { ingredient_name: input.trim() }
          : { ...input, ingredient_name: input.ingredient_name.trim() };

      if (!payload.ingredient_name) return null;

      try {
        const created = await apiFetch<MasterIngredient>('/api/ingredients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        // Safely update state without adding duplicates
        setAvailableIngredients((prev) => {
          const exists = prev.some(
            (ing) => ing.ingredient_id === created.ingredient_id
          );
          return exists ? prev : [...prev, created];
        });

        return created;
      } catch (err) {
        console.error('Error adding new ingredient:', err);
        alert('Could not add new ingredient to database.');
        return null;
      }
    };
    
    const [isAdding, setIsAdding] = useState(false);
    const [newClientName, setNewClientName] = useState('');

    const handleCreateClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedName = newClientName.trim();
    if (!trimmedName) {
      alert('Client name is required.');
      return;
    }

    const trimmedLocation = newLocation.trim();
    const parsedPopulation = newPopulation !== '' ? parseInt(newPopulation, 10) : null;
    const validPopulation =
      parsedPopulation && !Number.isNaN(parsedPopulation)
        ? Math.max(1, parsedPopulation)
        : null;

    try {
      const createdClient = await apiFetch<Client>('/api/client/new', {
        method: 'POST',
        body: JSON.stringify({
          client_name: trimmedName,
          contact_email: null,
          location: trimmedLocation || null,
          population: validPopulation,
        }),
      });

      setClients((prev) => [...prev, createdClient]);
      if (createdClient.client_id) {
        setSelectedClientId(createdClient.client_id);
      }

      // Reset existing form states
      setNewClientName('');
      setNewLocation('');
      setNewPopulation('');
      setIsAdding(false);
    } catch (err: any) {
      console.error('Error creating client:', err);
      alert(`Could not add new client: ${err?.message || 'Database error'}`);
    }
  };

  return (
    <div className={styles.opp_container}>
      <aside className={styles.sidebar_wrapper}>
        <nav className={styles.top_sidebar}>
          // this aint right
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('home')}>Main</button>
          <button className={styles.top_sidebar_btn} onClick={() => handleNavigation('generate')}>Generate</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('calendar')}>Calendar</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('saved')}>Saved</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('analytics')}>Analytics</button>
        </nav>

        {/*client list */}
        <div className={styles.client_section}>
          <div className={styles.client_section_header}>
            <span>Clients</span>
            <span className={styles.client_count}>{clients?.length ?? 0}</span>
          </div>
          <button 
            className={styles.add_client_trigger}
            onClick={() => setIsAdding(!isAdding)}
            title="Add new client"
          >
            {isAdding ? '✕ Cancel' : '+ Add'}
          </button>

          {isAdding && (
            <form className={styles.add_client_form} onSubmit={handleCreateClient}>
              <input
                type="text"
                placeholder="Enter client name..."
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className={styles.add_client_input}
                autoFocus
              />
              
              <input
                type="text"
                placeholder="Location (optional)..."
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className={styles.add_client_input}
              />

              <input
                type="number"
                placeholder="Population (optional)..."
                value={newPopulation}
                onChange={(e) => setNewPopulation(e.target.value)}
                className={styles.add_client_input}
                min="0"
              />

              <div className={styles.add_client_actions}>
                <button type="submit" className={styles.save_client_btn} disabled={!newClientName.trim()}>
                  Save
                </button>
              </div>
            </form>
          )}

          <div className={styles.client_list}>
            {clients?.map((client) => {
              const id = client.client_id ?? client.client_id;
              const isSelected = selectedClientId === id;
              
              return (
                <button
                  key={id}
                  className={`${styles.client_item} ${isSelected ? styles.client_item_active : ''}`}
                  onClick={() => setSelectedClientId(id)}
                >
                  <div className={styles.client_info}>
                    <span className={styles.client_name}>{client.client_name || `Client ${id}`}</span>
                    <span className={styles.client_id}>ID: #{id}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
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
            clients={clients}
            isLoadingClients={isLoadingClients}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            availableIngredients={availableIngredients}
            onCreateNewIngredient={handleCreateNewIngredient}
          />
        )}
        {activeView === 'calendar' && (
          <CalendarView 
          meals={meals}
          clients={clients}
          selectedClientId={selectedClientId}
          setSelectedClientId={setSelectedClientId}
           />
        )}
        {activeView === 'saved' && (
          <SavedView 
            meals={meals} 
            onEdit={(m: MealPlan) => handleNavigation('generate', m)} 
            onBack={() => setActiveView('home')} 
          />
        )}
        {activeView === 'analytics' && (
          <AnalyticsView 
            meals={meals} 
            clients={clients} 
          />
        )}
      </main>
    </div>
  );
}

// --- Sub-Components ---


function HomeView({ 
  meals, onNavigate
}: HomeViewProps) {
  const [addMode, setAddMode] = useState('button');


  const [selectedMealAId, setSelectedMealAId] = useState<number | string>(
    meals[0]?.meal_id ?? ''
  );
  const [selectedMealBId, setSelectedMealBId] = useState<number | string>(
    meals[1]?.meal_id ?? meals[0]?.meal_id ?? ''
  );

  const mealA = meals.find((m) => m.meal_id === Number(selectedMealAId)) || meals[0];
  const mealB = meals.find((m) => m.meal_id === Number(selectedMealBId)) || meals[1];

  const getIngredientCount = (ingredients?: MealPlan['ingredients']) => {
    if (!ingredients) return 0;
    if (Array.isArray(ingredients)) return ingredients.length;
    return 0;
  };

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

        {meals.slice(0, 6).map((meal: MealPlan) => (
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
      
      {/* 2. Menu Comparison Section */}
      <section className={styles.comparison_section}>
        <header className={styles.comparison_header}>
          <h3>Menu Comparison</h3>
          <p>Select two meals to evaluate nutritional differences and ingredients side-by-side.</p>
        </header>

        {meals.length < 2 ? (
          <div className={styles.comparison_placeholder}>
            <p>Add at least 2 meals to your library to enable menu comparison.</p>
          </div>
        ) : (

          
          <div className={styles.comparison_grid}>
            {/* Column A */}
            <div className={styles.comparison_column}>
              <label className={styles.selector_label}>
                Meal 1
                <select
                  value={selectedMealAId}
                  onChange={(e) => setSelectedMealAId(e.target.value)}
                  className={styles.meal_select}
                >
                  {meals.map((m) => (
                    <option key={`a-${m.meal_id}`} value={m.meal_id ?? ''}>
                      {m.meal_name}
                    </option>
                  ))}
                </select>
              </label>

              {mealA && (
                <div className={styles.comparison_card}>
                  <h4>{mealA.meal_name}</h4>
                  <span className={`${styles.status_tag} ${styles[mealA.status?.toLowerCase()]}`}>
                    {mealA.status}
                  </span>

                  <div className={styles.metric_list}>
                    <div className={styles.metric_row}>
                      <span>Calories / Serving</span>
                      <strong>{mealA.calories_per_serving} kcal</strong>
                    </div>
                    <div className={styles.metric_row}>
                      <span>Nutritional Score</span>
                      <strong>{mealA.nutritional_score ?? 'N/A'} / 10</strong>
                    </div>
                    <div className={styles.metric_row}>
                      <span>Ingredients</span>
                      <strong>{getIngredientCount(mealA.ingredients)} items</strong>
                    </div>
                  </div>

                  <button
                    className={styles.view_meal_btn}
                    onClick={() => onNavigate('generate', mealA)}
                  >
                    Open in Editor
                  </button>
                </div>
              )}
            </div>

            <div className={styles.versus_divider}>VS</div>

            {/* Column B */}
            <div className={styles.comparison_column}>
              <label className={styles.selector_label}>
                Meal 2
                <select
                  value={selectedMealBId}
                  onChange={(e) => setSelectedMealBId(e.target.value)}
                  className={styles.meal_select}
                >
                  {meals.map((m) => (
                    <option key={`a-${m.meal_id}`} value={m.meal_id ?? ''}>
                      {m.meal_name}
                    </option>
                  ))}
                </select>
              </label>

              {mealB && (
                <div className={styles.comparison_card}>
                  <h4>{mealB.meal_name}</h4>
                  <span className={`${styles.status_tag} ${styles[mealB.status?.toLowerCase()]}`}>
                    {mealB.status}
                  </span>

                  <div className={styles.metric_list}>
                    <div className={styles.metric_row}>
                      <span>Calories / Serving</span>
                      <strong>{mealB.calories_per_serving} kcal</strong>
                    </div>
                    <div className={styles.metric_row}>
                      <span>Nutritional Score</span>
                      <strong>{mealB.nutritional_score ?? 'N/A'} / 10</strong>
                    </div>
                    <div className={styles.metric_row}>
                      <span>Ingredients</span>
                      <strong>{getIngredientCount(mealB.ingredients)} items</strong>
                    </div>
                  </div>

                  <button
                    className={styles.view_meal_btn}
                    onClick={() => onNavigate('generate', mealB)}
                  >
                    Open in Editor
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      
    </div>
  );
}

function GenerateView({ 
  meal, onUpdateMeal, onBack, chatInput, setChatInput, chatHistory, onSendMessage, onResetChat, onSaveDraft, onAssignToClient, savedMealId, clients, isLoadingClients, selectedClientId, setSelectedClientId, availableIngredients, onCreateNewIngredient
}: GenerateViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<MasterIngredient | null>(null);
  const [ingredient_quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>('cups');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const matchingIngredients = Array.isArray(availableIngredients)
    ? availableIngredients.filter((item) =>
        item.ingredient_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const exactMatch = Array.isArray(availableIngredients)
    ? availableIngredients.some(
        (item) => item.ingredient_name?.toLowerCase() === searchTerm.trim().toLowerCase()
      )
    : false;

  

  const handleAddMealIngredient = (ingredient: MasterIngredient) => {
    if (!meal) return;

    const newEntry: MealIngredient = {
      ingredient_id: ingredient.ingredient_id,
      ingredient_name: ingredient.ingredient_name,
      ingredient_quantity,
      unit,
    };

    const updatedIngredients = [...(meal.ingredients || []), newEntry];
    onUpdateMeal({ ...meal, ingredients: updatedIngredients });

    // Reset controls
    setSearchTerm('');
    setSelectedIngredient(null);
    setQuantity(1);
  };

  // Create new ingredient on backend, then add to meal
  const handleCreateAndAdd = async () => {
    if (!searchTerm.trim()) return;
    setIsCreating(true);

    const created = await onCreateNewIngredient(searchTerm.trim(), unit);
    setIsCreating(false);

    if (created) {
      handleAddMealIngredient(created);
    }
  };

  const handleRemoveIngredient = (index: number) => {
    if (!meal) return;
    const updated = meal.ingredients.filter((_, i) => i !== index);
    onUpdateMeal({ ...meal, ingredients: updated });
  };


  const handleAssignSubmit = async (clientId: number) => {
    await onAssignToClient(clientId, assignmentDate);
    setIsModalOpen(false);
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
            <label>Calories (per serving)</label>
            <input 
              type="number" 
              value={meal?.calories_per_serving ?? ""} 
              onChange={(e) => meal && onUpdateMeal({ ...meal, calories_per_serving: Number(e.target.value) })}
            />
          </div>

          <div className={styles.metrics_dashboard}>
            <div className={styles.metric_card}>
              <span>Nutritional Score</span>
              <input
                type="number"
                className={styles.metric_input}
                value={meal?.nutritional_score ?? ''}
                onChange={(e) => meal && onUpdateMeal({ ...meal, nutritional_score: Number(e.target.value) })}
                placeholder="--"
                min="0"
                max="10"
                step="1"
              />
            </div>
            <div className={styles.metric_card}>
              <span>Status</span>
              <strong>{meal?.status ?? "--"}</strong>
            </div>
          </div>

          <section className={styles.ingredients_section}>
            <h3>Ingredients List</h3>

            {/* Structured Line Items List */}
            {/*restrict ingredient quantity to 2 decimal places pls */}
            <ul className={styles.ingredients_list}>
              {meal?.ingredients?.map((ing: MealIngredient, i: number) => (
                <li key={`${ing.ingredient_id}-${i}`} className={styles.ingredient_item}>
                  <span>
                    <strong>{ing.ingredient_quantity} {ing.unit}</strong> - {ing.ingredient_name}
                  </span>
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

            {/* Add Ingredient Combobox & Controls */}
            <div className={styles.add_ingredient_container} style={{ flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search or type new ingredient..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedIngredient(null);
                  }}
                  style={{ flex: 2 }}
                />

                {/* Quantity Input */}
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={ingredient_quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  style={{ flex: 1, minWidth: '70px' }}
                />

                {/* Unit Dropdown */}
                <select 
                  value={unit} 
                  onChange={(e) => setUnit(e.target.value)} 
                  style={{ flex: 1 }}
                >
                  <option value="g">g</option>
                  <option value="cups">cups</option>
                  <option value="whole">whole</option>
                  <option value="ml">ml</option>
                  <option value="tbsp">tbsp</option>
                  <option value="tsp">tsp</option>
                  <option value="slice">slice</option>
                  
                </select>
              </div>

              {/* Dropdown Suggestions & Creation Trigger */}
              {searchTerm.trim() !== '' && !selectedIngredient && (
                <div 
                  className={styles.suggestion_box} 
                  style={{ 
                    border: '1px solid #ccc', 
                    borderRadius: '4px', 
                    maxHeight: '150px', 
                    overflowY: 'auto',
                    backgroundColor: '#fff' 
                  }}
                >
                  {matchingIngredients.map((item) => (
                    <div
                      key={item.ingredient_id}
                      onClick={() => {
                        setSelectedIngredient(item);
                        setSearchTerm(item.ingredient_name);
                        if (item.unit) setUnit(item.unit);
                      }}
                      style={{ padding: '0.4rem 0.8rem', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                    >
                      {item.ingredient_name}
                    </div>
                  ))}

                  {!exactMatch && (
                    <button
                      type="button"
                      onClick={handleCreateAndAdd}
                      disabled={isCreating}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 0.8rem',
                        background: '#f0f8ff',
                        border: 'none',
                        color: '#0056b3',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {isCreating ? 'Saving...' : `+ Create "${searchTerm.trim()}" as new ingredient`}
                    </button>
                  )}
                </div>
              )}

              {/* Confirm Add Button for Existing Selection */}
              {selectedIngredient && (
                <button
                  type="button"
                  className={styles.add_ing_btn}
                  onClick={() => handleAddMealIngredient(selectedIngredient)}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  Add {selectedIngredient.ingredient_name} to Meal
                </button>
              )}
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

            <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
              <label 
                htmlFor="client-select" 
                style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem' }}
              >
                Select Client
              </label>
              <select 
                id="client-select"
                value={selectedClientId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedClientId(val === '' ? null : Number(val));
                }}
                disabled={isLoadingClients}
                style={{ 
                  width: '100%',
                  padding: '0.5rem', 
                  borderRadius: '4px', 
                  border: '1px solid #ccc',
                  fontSize: '0.95rem'
                }}
              >
                <option value="">
                  {isLoadingClients ? 'Loading clients...' : '-- Select a Client --'}
                </option>
                {clients.map((client) => (
                  <option key={client.client_id} value={client.client_id}>
                    {client.client_name || `Client #${client.client_id}`} (ID: {client.client_id})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.modal_actions} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={async () => {
                  if (!selectedClientId || !assignmentDate) {
                    alert("Please select both a client and an assignment date.");
                    return;
                  }
                  handleAssignSubmit(selectedClientId);
                }}
                disabled={!selectedClientId || !assignmentDate}
                className={styles.submit_button}
              >
                Confirm Assignment
              </button>
              <button onClick={() => setIsModalOpen(false)} className={styles.cancel_button}>
                Close
              </button>
            </div>
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

function CalendarView({ meals, selectedClientId, clients, setSelectedClientId }: CalendarViewProps) {
  type CalendarAssignments = Record<number, Record<string, string>>;

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  
  const [calendarAssignments, setCalendarAssignments] = useState<CalendarAssignments>({});
  const [activeMenuDate, setActiveMenuDate] = useState<string | null>(null);
  // loading not in use
  const [loading, setLoading] = useState<boolean>(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const daysInMonth = (month: number, year: number): number => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();

  const fetchClientAssignments = async (clientId: number) => {
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/api/client/${clientId}/assignments`);
      
      const assignmentArray = Array.isArray(data) 
        ? data 
        : (data?.assignments || []);

      setAssignments(assignmentArray);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  };

    useEffect(() => {
      if (selectedClientId) {
        fetchClientAssignments(selectedClientId);
      }
    }, [selectedClientId]);

    
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
            <option> </option>
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
          // console.log("Calendar dateKey:", dateKey, "Assignments loaded:", assignments);
          const localMeal = (selectedClientId && calendarAssignments?.[selectedClientId]) 
            ? calendarAssignments[selectedClientId][dateKey] 
            : null;

          const safeAssignments = Array.isArray(assignments) ? assignments : [];
          const backendMatch = safeAssignments.find(a => a?.assignment_date === dateKey);
          const backendMeal = backendMatch?.meal?.meal_name;

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

// --- COMPONENT ---

function AnalyticsView({ meals, clients }: AnalyticsViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'pricing'>('overview');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pricing / Ingredient Breakdown tab state
  const [breakdownMealId, setBreakdownMealId] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<MealBreakdownResponse | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState<boolean>(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  const totalMeals = meals?.length || 0;
  const activeMealsCount = meals?.filter(m => m.status?.toLowerCase() === 'active').length || 0;

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        let endpoint = '/api/operator/menu/analytics';
        if (activeTab === 'clients' && selectedClientId) {
          endpoint += `?client_id=${selectedClientId}`;
        }
        const data = await apiFetch<AnalyticsResponse>(endpoint);
        setAnalytics(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [activeTab, selectedClientId]);

  // Default the meal selector to the first available meal once the
  // Pricing & Ingredient Trends tab is opened.
  useEffect(() => {
    if (activeTab === 'pricing' && breakdownMealId === null && meals.length > 0) {
      setBreakdownMealId(meals[0].meal_id);
    }
  }, [activeTab, meals, breakdownMealId]);

  useEffect(() => {
    if (activeTab !== 'pricing' || breakdownMealId === null) return;

    const fetchBreakdown = async () => {
      try {
        setBreakdownLoading(true);
        setBreakdownError(null);
        const data = await apiFetch<MealBreakdownResponse>(`/api/meal/${breakdownMealId}/breakdown`);
        setBreakdown(data);
      } catch (err: any) {
        setBreakdownError(err.message || 'Failed to fetch meal breakdown');
        setBreakdown(null);
      } finally {
        setBreakdownLoading(false);
      }
    };

    fetchBreakdown();
  }, [activeTab, breakdownMealId]);

  const MICRO_LABELS: Array<{ key: keyof MealBreakdownTotals; label: string; unit: string }> = [
    { key: 'vitamin_a_mcg', label: 'Vitamin A', unit: 'mcg' },
    { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg' },
    { key: 'vitamin_b6_mg', label: 'Vitamin B6', unit: 'mg' },
    { key: 'vitamin_b12_mcg', label: 'Vitamin B12', unit: 'mcg' },
    { key: 'iron_mg', label: 'Iron', unit: 'mg' },
    { key: 'zinc_mg', label: 'Zinc', unit: 'mg' },
    { key: 'thiamin_mg', label: 'Thiamin', unit: 'mg' },
    { key: 'riboflavin_mg', label: 'Riboflavin', unit: 'mg' },
  ];

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  return (
    <div className={`${styles.analytics_container} ${styles.animate_mount}`}>
      <header className={styles.analytics_header}>
        <h2>Performance & Menu Analytics</h2>
        <p>Comprehensive insights into your menu catalog, operational changes, and client engagement.</p>
      </header>

      {/* Tab Navigation Bar */}
      <div className={styles.analytics_tabs}>
        <button 
          className={`${styles.analytics_tab_btn} ${activeTab === 'overview' ? styles.active_tab : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview & Activity
        </button>
        <button 
          className={`${styles.analytics_tab_btn} ${activeTab === 'clients' ? styles.active_tab : ''}`}
          onClick={() => setActiveTab('clients')}
        >
          Client Analytics
        </button>
        <button 
          className={`${styles.analytics_tab_btn} ${activeTab === 'pricing' ? styles.active_tab : ''}`}
          onClick={() => setActiveTab('pricing')}
        >
          Pricing & Ingredient Trends
        </button>
      </div>

      {/* TAB 1: OVERVIEW & ACTIVITY */}
      {activeTab === 'overview' && (
        <div className={styles.tab_content}>
          {/* Top-Level Catalog & Endpoint Metrics */}
          <div className={styles.analytics_metrics_grid}>
            <div className={styles.analytics_metric_card}>
              <span>Total Meals Catalog</span>
              <strong className={styles.analytics_val_primary}>{totalMeals}</strong>
            </div>
            <div className={styles.analytics_metric_card}>
              <span>Active Plans</span>
              <strong className={styles.analytics_val_success}>{activeMealsCount}</strong>
            </div>
            <div className={styles.analytics_metric_card}>
              <span>Client-Driven Changes</span>
              <strong className={styles.analytics_val_info}>
                {analytics?.summary.by_source['CLIENT'] || 0}
              </strong>
            </div>
            <div className={styles.analytics_metric_card}>
              <span>Operator Overwrites</span>
              <strong className={styles.analytics_val_warning}>
                {analytics?.summary.by_source['OPERATOR'] || 0}
              </strong>
            </div>
          </div>

          <div className={styles.analytics_sections_grid}>
            {/* Activity Log Panel */}
            <div className={`${styles.analytics_panel} ${styles.analytics_panel_large}`}>
              <h4>Recent Menu Activity </h4>
              
              {loading ? (
                <div className={styles.analytics_loading}>Loading analytics data...</div>
              ) : error ? (
                <div className={styles.analytics_error}>{error}</div>
              ) : analytics?.entries && analytics.entries.length > 0 ? (
                <div className={styles.analytics_log_table_wrapper}>
                  <table className={styles.analytics_log_table}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Source</th>
                        <th>Action</th>
                        <th>Client</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.entries.map((entry, idx) => (
                        <tr key={idx}>
                          <td className={styles.analytics_log_time}>
                            {formatDate(entry.timestamp)}
                          </td>
                          <td>
                            <span className={`${styles.analytics_badge} ${styles[`badge_${entry.source_category.toLowerCase()}`]}`}>
                              {entry.source_category}
                            </span>
                          </td>
                          <td className={styles.analytics_log_action}>
                            {entry.action.replace(/_/g, ' ')}
                          </td>
                          <td>
                            {entry.client_name ? (
                              <span className={styles.analytics_client_tag}>{entry.client_name}</span>
                            ) : (
                              <span className={styles.analytics_system_tag}>Global / System</span>
                            )}
                          </td>
                          <td className={styles.analytics_log_details}>
                            {entry.previous_meal_name && entry.new_meal_name ? (
                              <>
                                <span className={styles.analytics_strike}>{entry.previous_meal_name}</span> 
                                <span className={styles.analytics_arrow}>&rarr;</span> 
                                <strong>{entry.new_meal_name}</strong>
                              </>
                            ) : entry.new_meal_name ? (
                              <strong>{entry.new_meal_name}</strong>
                            ) : entry.changes ? (
                              <span className={styles.analytics_changes_json}>
                                {Object.entries(entry.changes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                              </span>
                            ) : (
                              <span className={styles.analytics_muted}>No meal details</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                 <div className={styles.analytics_empty}>No surfaced activity logged yet.</div>
              )}
            </div>

            {/* Change Breakdown Panel */}
            <div className={styles.analytics_panel}>
              <h4>Change Breakdown by Action</h4>
              <div className={styles.analytics_list}>
                {analytics?.summary.by_action && Object.entries(analytics.summary.by_action).map(([action, count]) => (
                  <div className={styles.analytics_row} key={action}>
                    <span className={styles.analytics_action_name}>{action.replace(/_/g, ' ')}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
                {!analytics?.summary.by_action || Object.keys(analytics.summary.by_action).length === 0 ? (
                  <div className={styles.analytics_empty_small}>No actions recorded</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLIENT ANALYTICS */}
      {activeTab === 'clients' && (
        <div className={styles.tab_content}>
          <div className={styles.filter_toolbar}>
            <label>Select Client: </label>
            <select 
              value={selectedClientId} 
              onChange={(e) => setSelectedClientId(e.target.value)}
              className={styles.analytics_select}
            >
              <option value="">-- All Clients --</option>
              {clients.map(c => (
                <option key={c.client_id} value={c.client_id}>{c.client_name}</option>
              ))}
            </select>
          </div>
          {/* Client-specific metrics and view can go here */}
        </div>
      )}

      {/* TAB 3: PRICING & INGREDIENT TRENDS / MEAL INFO */}
      {activeTab === 'pricing' && (
        <div className={styles.tab_content}>
          <div className={styles.filter_toolbar}>
            <label>Select Meal: </label>
            <select
              value={breakdownMealId ?? ''}
              onChange={(e) => setBreakdownMealId(e.target.value ? Number(e.target.value) : null)}
              className={styles.analytics_select}
            >
              {meals.length === 0 && <option value="">No meals available</option>}
              {meals.map((m) => (
                <option key={m.meal_id} value={m.meal_id ?? ''}>{m.meal_name}</option>
              ))}
            </select>
          </div>

          {breakdownLoading ? (
            <div className={styles.analytics_loading}>Loading meal breakdown...</div>
          ) : breakdownError ? (
            <div className={styles.analytics_error}>{breakdownError}</div>
          ) : breakdown ? (
            <>
              {/* Summary Cards */}
              <div className={styles.analytics_metrics_grid}>
                <div className={styles.analytics_metric_card}>
                  <span>Estimated Cost / Serving</span>
                  <strong className={styles.analytics_val_primary}>
                    ${breakdown.totals.total_cost.toFixed(2)}
                  </strong>
                </div>
                <div className={styles.analytics_metric_card}>
                  <span>Total Calories</span>
                  <strong className={styles.analytics_val_success}>
                    {breakdown.totals.energy_kcal.toFixed(0)} kcal
                  </strong>
                </div>
                <div className={styles.analytics_metric_card}>
                  <span>Total Protein</span>
                  <strong className={styles.analytics_val_info}>
                    {breakdown.totals.protein_g.toFixed(1)} g
                  </strong>
                </div>
                <div className={styles.analytics_metric_card}>
                  <span>Total Carbs</span>
                  <strong className={styles.analytics_val_warning}>
                    {breakdown.totals.carb_g.toFixed(1)} g
                  </strong>
                </div>
                <div className={styles.analytics_metric_card}>
                  <span>Total Fat</span>
                  <strong>{breakdown.totals.fat_g.toFixed(1)} g</strong>
                </div>
              </div>

              <div className={styles.analytics_sections_grid}>
                {/* Itemized Ingredient Table */}
                <div className={`${styles.analytics_panel} ${styles.analytics_panel_large}`}>
                  <h4>Itemized Ingredients</h4>
                  {breakdown.ingredients.length > 0 ? (
                    <div className={styles.analytics_log_table_wrapper}>
                      <table className={styles.analytics_log_table}>
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th>Category</th>
                            <th>Quantity</th>
                            <th>Cost</th>
                            <th>Protein (g)</th>
                            <th>Carbs (g)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdown.ingredients.map((item) => (
                            <tr key={item.ingredient_id}>
                              <td>{item.ingredient_name}</td>
                              <td>{item.category || 'n/a'}</td>
                              <td>{item.quantity} {item.unit}</td>
                              <td>${item.cost_contribution.toFixed(2)}</td>
                              <td>{item.has_nutrition_data ? (item.macros.protein_g ?? 0).toFixed(1) : '—'}</td>
                              <td>{item.has_nutrition_data ? (item.macros.carb_g ?? 0).toFixed(1) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={styles.analytics_empty}>No ingredients on this meal.</div>
                  )}
                </div>

                {/* Nutritional Micro Breakdown */}
                <div className={styles.analytics_panel}>
                  <h4>Nutritional Micro Breakdown</h4>
                  <div className={styles.analytics_list}>
                    {MICRO_LABELS.map(({ key, label, unit }) => (
                      <div className={styles.analytics_row} key={key}>
                        <span className={styles.analytics_action_name}>{label}</span>
                        <strong>{breakdown.totals[key].toFixed(2)} {unit}</strong>
                      </div>
                    ))}
                  </div>

                  {breakdown.ingredients.some((i) => i.has_nutrition_data) && (
                    <details style={{ marginTop: '1rem' }}>
                      <summary>Per-ingredient micro detail</summary>
                      {breakdown.ingredients
                        .filter((i) => i.has_nutrition_data)
                        .map((item) => (
                          <div key={item.ingredient_id} style={{ marginTop: '0.5rem' }}>
                            <strong>{item.ingredient_name}</strong>
                            <div className={styles.analytics_muted}>
                              Fe {(item.micros.iron_mg ?? 0).toFixed(2)}mg · Zn {(item.micros.zinc_mg ?? 0).toFixed(2)}mg
                              {' '}· Vit A {(item.micros.vitamin_a_mcg ?? 0).toFixed(1)}mcg · Vit C {(item.micros.vitamin_c_mg ?? 0).toFixed(1)}mg
                              {' '}· Vit B12 {(item.micros.vitamin_b12_mcg ?? 0).toFixed(2)}mcg
                            </div>
                          </div>
                        ))}
                    </details>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.analytics_empty}>Select a meal to view its cost & nutrition breakdown.</div>
          )}
        </div>
      )}
    </div>
  );
}

 