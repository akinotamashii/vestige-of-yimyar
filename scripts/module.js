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
        performVestigeRest
    };
    
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
        
        console.log("Vestige of Yimyar | Macros registration complete");
    } catch (error) {
        console.error("Vestige of Yimyar | Error creating macros:", error);
    }
}