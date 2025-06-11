import { registerSettings } from "./settings.js";
import { setupVestigeToll, applyVestigeToll } from "./vestige-toll.js";
import { performVestigeRest, setupVestigeRest } from "./vestige-rest.js";

// Initialization hook
Hooks.once('init', async function() {
    console.log('Vestige of Yimyar | Initializing');
    
    // Register module
    registerSettings();
    preloadTemplates();
    
    // Initialize the global module object EARLY in init
    // This ensures it exists before macros try to use it
    game.vestigeOfYimyar = {
        applyVestigeToll,
        performVestigeRest,
        // Add storage for dynamic toll parameters
        lastTollFormula: null,
        lastItemName: null
    };
    
    // Register custom Handlebars helper for vestige toll buttons
    Handlebars.registerHelper('vestigeTollButton', function(formula, itemName) {
        const buttonText = formula.includes('d') ? 
            `<i class="fas fa-dice-d20"></i> Roll ${formula} Toll` : 
            `<i class="fas fa-heart-broken"></i> Pay ${formula} Toll`;
            
        return new Handlebars.SafeString(
            `<a class="vestige-toll-link" data-formula="${formula}" data-item-name="${itemName || ''}">
              ${buttonText}
            </a>`
        );
    });
    
    console.log('Vestige of Yimyar | API initialized');
});

// Ready hook for everything else
Hooks.once('ready', async function() {
    console.log('Vestige of Yimyar | Ready');
    
    // Setup core mechanics
    setupVestigeToll();
    setupVestigeRest();
    
    // Register macro functionality
    registerMacros();
    
    // Expose API for macros to use
    game.modules.get("vestige-of-yimyar").api = {
      applyVestigeToll: applyVestigeToll,
      performVestigeRest: performVestigeRest
    };
    
    // Add click handler for dynamic toll links
    $(document).on('click', '.vestige-toll-link', function(event) {
        const formula = $(this).data('formula');
        const itemName = $(this).data('item-name');
        
        // Store for the macro to use
        game.vestigeOfYimyar.lastTollFormula = formula;
        game.vestigeOfYimyar.lastItemName = itemName;
        
        // Find and execute the macro
        const macro = game.macros.find(m => m.name === "Apply Dynamic Vestige Toll");
        if (macro) {
            macro.execute();
        } else {
            ui.notifications.error("Dynamic Vestige Toll macro not found");
        }
    });
    
    // Debug information
    console.log('Vestige of Yimyar | API check:', {
        apiExists: !!game.vestigeOfYimyar,
        tollFunction: !!game.vestigeOfYimyar?.applyVestigeToll,
        restFunction: !!game.vestigeOfYimyar?.performVestigeRest
    });
});

// Preload handlebars templates
async function preloadTemplates() {
    const templatePaths = [
        "modules/vestige-of-yimyar/templates/vestige-toll-dialog.hbs",
        "modules/vestige-of-yimyar/templates/settings-menu.hbs"
    ];
    
    return loadTemplates(templatePaths);
}

// Create macros for Vestige's Toll features
function registerMacros() {
    try {
        // Check if the macros already exist to avoid duplicates
        const tollMacroExists = game.macros.find(m => 
            m.name === "Apply Vestige's Toll" && 
            m.command.includes("vestigeOfYimyar.applyVestigeToll")
        );
        
        const restMacroExists = game.macros.find(m => 
            m.name === "Vestige Rest" && 
            m.command.includes("vestigeOfYimyar.performVestigeRest")
        );
        
        const dynamicTollMacroExists = game.macros.find(m => 
            m.name === "Apply Dynamic Vestige Toll"
        );
        
        // Only create macros if they don't exist and the user has permission
        if (!tollMacroExists && game.user.isGM) {
            Macro.create({
                name: "Apply Vestige's Toll",
                type: "script",
                img: "icons/svg/aura.svg",
                command: `
                if (!game.vestigeOfYimyar) {
                    ui.notifications.error("Vestige of Yimyar module not initialized properly");
                    console.error("game.vestigeOfYimyar is undefined");
                    return;
                }
                game.vestigeOfYimyar.applyVestigeToll();`
            }).then(macro => {
                console.log("Vestige of Yimyar | Created Toll macro");
            });
        }
        
        if (!restMacroExists && game.user.isGM) {
            Macro.create({
                name: "Vestige Rest",
                type: "script",
                img: "icons/svg/sleep.svg",
                command: `
                if (!game.vestigeOfYimyar) {
                    ui.notifications.error("Vestige of Yimyar module not initialized properly");
                    console.error("game.vestigeOfYimyar is undefined");
                    return;
                }
                game.vestigeOfYimyar.performVestigeRest();`
            }).then(macro => {
                console.log("Vestige of Yimyar | Created Rest macro");
            });
        }
        
        // Create the dynamic vestige toll macro
        if (!dynamicTollMacroExists && game.user.isGM) {
            Macro.create({
                name: "Apply Dynamic Vestige Toll",
                type: "script",
                img: "icons/svg/dice-target.svg",
                command: `
                // Universal Vestige's Toll Macro
                (async () => {
                  // Get parameters from the triggering element
                  const formula = game.vestigeOfYimyar.lastTollFormula;
                  const itemName = game.vestigeOfYimyar.lastItemName;
                  
                  if (!formula) {
                    ui.notifications.error("No toll formula specified");
                    return;
                  }
                  
                  try {
                    // Process variables in the formula
                    let processedFormula = formula;
                    
                    if (formula.includes('@lvl')) {
                      const actor = game.user.character || canvas.tokens.controlled[0]?.actor;
                      if (actor) {
                        const level = actor.system.details?.level?.value || 1;
                        processedFormula = formula.replace(/@lvl/g, level);
                      }
                    }
                    
                    // Roll the formula if it contains dice
                    if (processedFormula.includes('d') || processedFormula.includes('+') || processedFormula.includes('*')) {
                      const roll = await new Roll(processedFormula).evaluate({async: true});
                      
                      // Show the roll in chat
                      await roll.toMessage({
                        speaker: ChatMessage.getSpeaker(),
                        flavor: \`Vestige's Toll for \${itemName || "ability"}\`
                      });
                      
                      // Apply the toll
                      await game.vestigeOfYimyar.applyVestigeToll(roll.total);
                    } else {
                      // Apply fixed amount
                      const amount = parseInt(processedFormula);
                      if (isNaN(amount)) {
                        ui.notifications.error(\`Invalid toll amount: \${processedFormula}\`);
                        return;
                      }
                      await game.vestigeOfYimyar.applyVestigeToll(amount);
                    }
                  } catch (error) {
                    ui.notifications.error(\`Error applying Vestige's Toll: \${error.message}\`);
                    console.error(error);
                  }
                  
                  // Clear the stored formula
                  game.vestigeOfYimyar.lastTollFormula = null;
                  game.vestigeOfYimyar.lastItemName = null;
                })();`
            }).then(macro => {
                console.log("Vestige of Yimyar | Created Dynamic Toll macro");
            });
        }
        
        console.log("Vestige of Yimyar | Macros registration complete");
    } catch (error) {
        console.error("Vestige of Yimyar | Error creating macros:", error);
    }
}