export async function applyVestigeToll() {
    // Get selected actor
    const actor = game.user.character || canvas.tokens.controlled[0]?.actor;
    if (!actor) {
        ui.notifications.warn("Please select a character or token");
        return;
    }
    
    // Get current HP values
    const maxHP = actor.system.attributes.hp.max;
    const currentHP = actor.system.attributes.hp.value;
    
    // Get total toll already applied (if any)
    const totalToll = actor.getFlag("vestige-of-yimyar", "totalToll") || 0;
    
    // Show dialog to select amount of HP to convert
    const tollAmount = await promptForTollAmount(actor);
    if (!tollAmount || tollAmount <= 0) return;
    
    // Apply the toll
    await processToll(actor, tollAmount);
}

async function promptForTollAmount(actor) {
    const currentHP = actor.system.attributes.hp.value;
    const maxToll = currentHP - 1; // Can't go below 1 HP
    
    const content = await renderTemplate("modules/vestige-of-yimyar/templates/vestige-toll-dialog.hbs", {
        name: actor.name,
        currentHP,
        maxToll
    });
    
    return new Promise(resolve => {
        new Dialog({
            title: "Pay Vestige's Toll",
            content: content,
            buttons: {
                pay: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Pay Toll",
                    callback: html => {
                        const amount = parseInt(html.find("#toll-amount").val());
                        resolve(amount);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel",
                    callback: () => resolve(0)
                }
            },
            default: "pay"
        }).render(true);
    });
}

async function processToll(actor, amount) {
    // Calculate new values
    const currentHP = actor.system.attributes.hp.value;
    const currentTempHP = actor.system.attributes.hp.temp || 0;
    const maxHP = actor.system.attributes.hp.max;
    
    // Get total toll already applied (if any)
    const totalToll = actor.getFlag("vestige-of-yimyar", "totalToll") || 0;
    
    // Ensure we don't reduce below 1 HP
    const maxReduction = Math.max(0, currentHP - 1);
    const actualReduction = Math.min(amount, maxReduction);
    
    // Calculate new total toll
    const newTotalToll = totalToll + actualReduction;
    
    // Calculate new effective max HP (never below 1)
    const newEffectiveMaxHP = Math.max(1, maxHP - newTotalToll);
    
    // Set new values
    const newHP = currentHP - actualReduction;
    // Ensure temp HP never exceeds the total toll amount
    const newTempHP = Math.min(currentTempHP + actualReduction, newTotalToll);
    
    console.log("Vestige of Yimyar | Processing toll:", {
        originalHP: currentHP,
        reducedBy: actualReduction,
        newHP: newHP,
        originalTempHP: currentTempHP,
        newTempHP: newTempHP,
        previousTotalToll: totalToll,
        newTotalToll: newTotalToll,
        originalMaxHP: maxHP,
        newEffectiveMaxHP: newEffectiveMaxHP
    });
    
    // Update the actor
    await actor.update({
        "system.attributes.hp.value": newHP,
        "system.attributes.hp.temp": newTempHP
    });
    
    // Set flags to track Vestige's Toll state
    await actor.setFlag("vestige-of-yimyar", "vestigeToll", true);
    await actor.setFlag("vestige-of-yimyar", "totalToll", newTotalToll);
    await actor.setFlag("vestige-of-yimyar", "effectiveMaxHP", newEffectiveMaxHP);
    
    // Apply the toll effect
    await applyTollEffect(actor);
    
    ui.notifications.info(`Applied Vestige's Toll: Converted ${actualReduction} HP to temporary HP (Total toll: ${newTotalToll})`);
    
    return { newHP, newTempHP, newTotalToll, newEffectiveMaxHP };
}

// Now we need to set up hooks to handle HP changes from healing, etc.
export function setupVestigeToll() {
    console.log("Vestige of Yimyar | Setting up Vestige's Toll");
    
    // Hook into the preUpdateActor hook to modify healing behavior
    Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
        // Skip processing if this update is from vestige-rest
        if (options.vestiges?.isRest) return;
        
        // Only process if this update includes HP changes
        if (!changes.system?.attributes?.hp) return;
        
        // Only process if this actor has paid a Vestige's Toll
        const hasToll = actor.getFlag("vestige-of-yimyar", "vestigeToll");
        if (!hasToll) return;
        
        // Get the total toll and effective max HP
        const totalToll = actor.getFlag("vestige-of-yimyar", "totalToll") || 0;
        const effectiveMaxHP = actor.getFlag("vestige-of-yimyar", "effectiveMaxHP") || 
                              Math.max(1, actor.system.attributes.hp.max - totalToll);
        
        // Current values
        const currentHP = actor.system.attributes.hp.value;
        const currentTempHP = actor.system.attributes.hp.temp || 0;
        
        // New values from the update
        const newHP = changes.system.attributes.hp.value;
        const newTempHP = changes.system.attributes.hp.temp;
        
        // If this is a healing effect (HP is increasing)
        if (newHP !== undefined && newHP > currentHP) {
            // Calculate the healing amount
            const healingAmount = newHP - currentHP;
            
            // Calculate how much can go to regular HP (up to effective max)
            const regularHPDeficit = effectiveMaxHP - currentHP;
            const regularHPHealing = Math.min(healingAmount, regularHPDeficit);
            
            // Any remaining healing goes to temp HP, up to the total toll amount
            const remainingHealing = healingAmount - regularHPHealing;
            const tempHPHealing = Math.min(remainingHealing, totalToll - currentTempHP);
            
            // Set the new values in the update
            changes.system.attributes.hp.value = currentHP + regularHPHealing;
            
            // Only set temp HP if it was included in the update or if we have temp healing
            if (newTempHP !== undefined || tempHPHealing > 0) {
                const baseTempHP = newTempHP !== undefined ? newTempHP : currentTempHP;
                changes.system.attributes.hp.temp = Math.min(
                    baseTempHP + tempHPHealing,
                    totalToll // Temp HP can never exceed total toll
                );
            }
            
            console.log("Vestige of Yimyar | Modified healing:", {
                originalHealing: healingAmount,
                appliedToRegularHP: regularHPHealing,
                appliedToTempHP: tempHPHealing,
                newHP: changes.system.attributes.hp.value,
                newTempHP: changes.system.attributes.hp.temp,
                effectiveMaxHP: effectiveMaxHP,
                totalToll: totalToll
            });
        }
        
        // Also enforce temp HP maximum based on total toll
        if (newTempHP !== undefined && newTempHP > totalToll) {
            changes.system.attributes.hp.temp = totalToll;
            console.log(`Vestige of Yimyar | Limited temp HP to total toll: ${totalToll}`);
        }
    });
    
    // Add a hook to modify max HP display in the character sheet
    Hooks.on("renderActorSheet", (app, html, data) => {
        const actor = app.actor;
        if (!actor) return;
        
        // Only process if this actor has paid a Vestige's Toll
        const hasToll = actor.getFlag("vestige-of-yimyar", "vestigeToll");
        if (!hasToll) return;
        
        const totalToll = actor.getFlag("vestige-of-yimyar", "totalToll") || 0;
        const originalMaxHP = actor.system.attributes.hp.max;
        const effectiveMaxHP = Math.max(1, originalMaxHP - totalToll);
        
        // Find the max HP display element
        const maxHPElement = html.find('.hp-max');
        if (maxHPElement.length) {
            // Show both values - effective/original
            maxHPElement.html(`${effectiveMaxHP}/${originalMaxHP}`);
            
            // Add tooltip
            maxHPElement.attr('title', `Effective Max HP: ${effectiveMaxHP}\nOriginal Max HP: ${originalMaxHP}\nVestige's Toll: ${totalToll}`);
            
            // Add visual indication
            maxHPElement.css('color', '#e57373');
        }
    });
}

// Apply the effect to the actor - this remains largely the same
export async function applyTollEffect(actor) {
    try {
        console.log("Vestige of Yimyar | Applying toll effect to:", actor.name);

        // First, remove any existing effects
        const existingEffects = actor.items?.filter(e => {
            if (!e || !e.flags) return false;
            return e.flags["vestige-of-yimyar"]?.isVestigeToll === true;
        }) || [];

        console.log("Vestige of Yimyar | Found existing effect:", existingEffects);

        if (existingEffects.length > 0) {
            console.log("Vestige of Yimyar | Removing existing effects before adding new one");
            const effectIds = existingEffects.map(e => e.id);
            await actor.deleteEmbeddedDocuments("Item", effectIds);
        }

        // Get the effect from the compendium
        console.log("Vestige of Yimyar | Fetching effect from compendium");

        // Get the compendium
        const pack = game.packs.get("vestige-of-yimyar.vestige-features");
        if (!pack) {
            console.error("Compendium not found: vestige-of-yimyar.vestige-features");
            ui.notifications.error("Vestige's Toll compendium not found");
            return;
        }

        // Make sure the index is loaded
        await pack.getIndex();
        console.log("Vestige of Yimyar | Compendium index loaded:", pack.index.size, "entries");

        // Find the effect by name or slug
        const effectEntry = pack.index.find(i =>
            i.name === "Vestige's Toll" ||
            (i.system && i.system.slug === "vestiges-toll")
        );

        if (!effectEntry) {
            console.error("Vestige of Yimyar | Effect not found in compendium");
            ui.notifications.error("Vestige's Toll effect not found in compendium");
            return;
        }

        console.log("Vestige of Yimyar | Found effect in compendium:", effectEntry.name);

        // Get the full document
        const effect = await pack.getDocument(effectEntry._id);
        if (!effect) {
            console.error("Vestige of Yimyar | Could not load effect document");
            ui.notifications.error("Could not load Vestige's Toll effect");
            return;
        }

        // Get current total toll
        const totalToll = actor.getFlag("vestige-of-yimyar", "totalToll") || 0;

        // Clone the effect and add a counter for current vestige toll
        let effectData = effect.toObject();
        effectData.flags = effectData.flags || {};
        effectData.flags["vestige-of-yimyar"] = {
            ...(effectData.flags["vestige-of-yimyar"] || {}),
            isVestigeToll: true,
            tollCounter: totalToll
        };

        // Optionally, add the counter to the effect's name or description for visibility
        effectData.name = `Vestige's Toll (${totalToll})`;
        if (effectData.description) {
            effectData.description.value = `Current Vestige Toll: ${totalToll}<br>` + effectData.description.value;
        } else if (effectData.system && effectData.system.description) {
            effectData.system.description.value = `Current Vestige Toll: ${totalToll}<br>` + (effectData.system.description.value || "");
        }

        // Apply the effect to the actor
        console.log("Vestige of Yimyar | Applying effect from compendium with toll counter");
        await actor.createEmbeddedDocuments("Item", [effectData]);

        console.log("Vestige of Yimyar | Applied toll effect successfully");
    } catch (error) {
        console.error("Vestige of Yimyar | Error applying toll effect:", error);
        console.error("Error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        ui.notifications.error("Could not apply Vestige's Toll effect: " + error.message);
    }
}