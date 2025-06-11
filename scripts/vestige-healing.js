// Set up healing redirection for Vestige's Toll
export function setupVestigeHealing() {
    // Hook into healing operations
    console.log("Vestige of Yimyar | Setting up Vestige Healing redirection");
    Hooks.on("preUpdateActor", interceptHealing);
}

async function interceptHealing(actor, changes, options, userId) {
    // Check if this is a healing operation (HP increase)
    if (!changes.system?.attributes?.hp?.value) return;
    
    // Check if the actor has Vestige's Toll
    const hasToll = actor.getFlag("vestige-of-yimyar", "vestigeToll");
    if (!hasToll) return;
    
    // Get current values
    const currentHP = actor.system.attributes.hp.value;
    const currentTempHP = actor.system.attributes.hp.temp || 0;
    const newHP = changes.system.attributes.hp.value;
    
    // Only intercept healing, not damage
    if (newHP <= currentHP) return;
    
    // Calculate the healing amount
    const healingAmount = newHP - currentHP;
    console.log(`Vestige's Toll: Redirecting ${healingAmount} healing to temp HP`);
    
    // Redirect healing to temp HP
    changes.system.attributes.hp.value = currentHP; // Keep HP the same
    
    // Make sure temp HP is included in the changes
    if (!changes.system.attributes.hp.hasOwnProperty('temp')) {
        changes.system.attributes.hp.temp = currentTempHP + healingAmount;
    } else {
        changes.system.attributes.hp.temp += healingAmount;
    }
    
    // Show a message
    ui.notifications.info(`Vestige's Toll redirected ${healingAmount} healing to temporary HP`);
}