// Import the applyTollEffect function at the top of the file
import { applyTollEffect } from "./vestige-toll.js";

// Set up rest mechanics for Vestige's Toll
export function setupVestigeRest() {
    console.log("Vestige of Yimyar | Setting up Vestige Rest");
}

// Perform a Vestige rest (with temp HP conversion and standard rest mechanics)
export async function performVestigeRest(actorParam = null) {
    // Get selected actor
    const actor = actorParam || game.user.character || canvas.tokens.controlled[0]?.actor;
    if (!actor) {
        ui.notifications.warn("Please select a character or token");
        return;
    }
    
    // Check if actor has the Vestige's Toll flag
    const hasToll = actor.getFlag("vestige-of-yimyar", "vestigeToll");
    
    // Store initial values for logging/comparison
    const initialHP = actor.system.attributes.hp.value;
    const initialTempHP = actor.system.attributes.hp.temp || 0;
    const maxHP = actor.system.attributes.hp.max;
    
    // Get the character's Constitution modifier and level for PF2e rest calculation
    const conMod = actor.system.abilities?.con?.mod || 0;
    const level = actor.system.details?.level?.value || 1;
    
    // Calculate the correct PF2e rest healing amount (Con mod × level)
    const restHealAmount = Math.max(0, conMod * level);
    
    console.log("Vestige of Yimyar | Starting rest with values:", {
        actor: actor.name,
        initialHP,
        initialTempHP,
        maxHP,
        conMod,
        level,
        restHealAmount,
        hasToll
    });
    
    // First try to restore spell slots and other resources
    try {
            // Use the built-in rest method
            await game.pf2e.actions.restForTheNight(actor);
            console.log("Vestige of Yimyar | Standard rest completed");
    } catch (error) {
        console.error("Vestige of Yimyar | Error in spell/resource restoration:", error);
    }
    
    // Always process Vestige's Toll conversion if applicable, regardless of rest method
    if (hasToll) {
        try {
            // Get the actor again to make sure we have the latest values
            const updatedActor = game.actors.get(actor.id);
            
            // Get the total toll and effective max HP
            const totalToll = updatedActor.getFlag("vestige-of-yimyar", "totalToll") || 0;
            const effectiveMaxHP = updatedActor.getFlag("vestige-of-yimyar", "effectiveMaxHP") || 
                                Math.max(1, maxHP - totalToll);
            
            // Current HP values (might have changed from standard rest)
            const currentHP = updatedActor.system.attributes.hp.value;
            const currentTempHP = updatedActor.system.attributes.hp.temp || 0;
            
            // Calculate how much HP we can restore through rest
            // We need to decide how to split the healing between regular healing and toll conversion
            // New approach: Always convert some temp HP, even if HP isn't full
            
            // Calculate total healing budget
            const healingBudget = restHealAmount;
            
            // CHANGE: Prioritize conversion over regular healing
            // Always convert as much temp HP as possible within the healing budget
            const maxPossibleConversion = Math.min(
                healingBudget,     // Limited by total healing budget
                currentTempHP      // Limited by available temp HP
            );
            
            // Any remaining healing budget goes to regular HP
            const regularHealingBudget = maxPossibleConversion;
            
            // Calculate how much regular healing to apply
            const missingHP = effectiveMaxHP - currentHP;
            const regularHealing = Math.min(missingHP, regularHealingBudget);
            
            // Calculate the new values
            const updatedHP = currentHP + regularHealing + maxPossibleConversion;
            const updatedTempHP = currentTempHP - maxPossibleConversion;
            
            // Calculate the new total toll (reduced by the amount converted)
            const newTotalToll = Math.max(0, totalToll - maxPossibleConversion);
            
            console.log("Vestige of Yimyar | Vestige Rest Calculations:", {
                totalToll,
                effectiveMaxHP,
                currentHP,
                currentTempHP,
                healingBudget,
                maxPossibleConversion,    
                regularHealingBudget,
                missingHP,
                regularHealing,
                newHP: updatedHP,
                newTempHP: updatedTempHP,
                newTotalToll
            });
            
            
            // Set/update the toll flags
            if (newTotalToll > 0) {
                // Set flags for remaining toll
                await updatedActor.setFlag("vestige-of-yimyar", "totalToll", newTotalToll);
                
                // Recalculate the effective max HP based on the new total toll
                const newEffectiveMaxHP = Math.max(1, maxHP - newTotalToll);
                await updatedActor.setFlag("vestige-of-yimyar", "effectiveMaxHP", newEffectiveMaxHP);
                
                // Use the existing applyTollEffect function to update the effect
                await applyTollEffect(updatedActor);
                
                ui.notifications.info(`Vestige Rest: Restored ${regularHealing} HP and converted ${maxPossibleConversion} temporary HP. Remaining toll: ${newTotalToll}`);
            } else {
                // If no more toll, remove all vestige flags
                await updatedActor.unsetFlag("vestige-of-yimyar", "vestigeToll");
                await updatedActor.unsetFlag("vestige-of-yimyar", "totalToll");
                await updatedActor.unsetFlag("vestige-of-yimyar", "effectiveMaxHP");
                await removeTollEffect(updatedActor);
                ui.notifications.info("Vestige's Toll has been fully paid off.");
            }
                        // Apply the HP and temp HP changes
            await updatedActor.update({
                "system.attributes.hp.value": updatedHP,
                "system.attributes.hp.temp": updatedTempHP
            }, { 
                vestiges: { isRest: true } 
            });
        } catch (error) {
            console.error("Vestige of Yimyar | Error in Vestige's Toll conversion:", error);
            ui.notifications.error("Error converting temporary HP: " + error.message);
        }
    } else {
        ui.notifications.info("Rest completed. This character has not paid a Vestige's Toll.");
    }
    
    // Final verification
    const finalActor = game.actors.get(actor.id);
    const finalHP = finalActor.system.attributes.hp.value;
    // Fix: Get the temp HP directly from the actor, not from the variable
    const finalTempHP = finalActor.system.attributes.hp.temp || 0;
    
    // Create a chat message with the rest results
    try {
        const hpChange = finalHP - initialHP;
        const tempHPChange = finalTempHP - initialTempHP;
        
        console.log("Vestige of Yimyar | Creating chat message with:", {
            initialHP, finalHP, hpChange,
            initialTempHP, finalTempHP, tempHPChange
        });
        
        // Create chat message content
        let chatContent = `
        <div class="vestige-rest-report" style="border: 1px solid #7a7971; border-radius: 5px; padding: 10px; background: #f0f0e0;">
            <h3 style="margin-top: 0; border-bottom: 1px solid #7a7971; padding-bottom: 5px;">
                <img src="${finalActor.img}" width="36" height="36" style="border: none; vertical-align: middle; border-radius: 18px; margin-right: 5px;"> 
                ${finalActor.name} - Rest Report
            </h3>
            <div style="display: grid; grid-template-columns: auto auto; gap: 5px;">
                <div><strong>HP Change:</strong></div>
                <div style="color: ${hpChange >= 0 ? 'green' : 'red'};">${hpChange >= 0 ? '+' : ''}${hpChange} HP</div>
                
                <div><strong>Current HP:</strong></div>
                <div>${finalHP} / ${finalActor.system.attributes.hp.max}</div>`;
        
        // If character had a toll, add specific vestige details
        if (hasToll) {
            const totalToll = finalActor.getFlag("vestige-of-yimyar", "totalToll") || 0;
            const tollPaid = Math.max(0, initialTempHP - finalTempHP);
            
            chatContent += `
                <div><strong>Temp HP Change:</strong></div>
                <div style="color: ${tempHPChange >= 0 ? 'green' : '#9c5eb5'}">${tempHPChange >= 0 ? '+' : ''}${tempHPChange}</div>
                
                <div><strong>Vestige's Toll Paid:</strong></div>
                <div style="color: #9c5eb5;">+${tollPaid} HP recovered</div>
                
                <div><strong>Remaining Toll:</strong></div>
                <div>${totalToll}</div>`;
                
            if (totalToll === 0) {
                chatContent += `
                <div colspan="2" style="grid-column: span 2; margin-top: 5px; font-style: italic; color: #9c5eb5;">
                    The Vestige's Toll has been fully paid off!
                </div>`;
            }
        }
        
        // Close the grid and container div
        chatContent += `
            </div>
        </div>`;
        
        // Send the chat message - return the promise for better error handling
        return ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({actor: finalActor}),
            content: chatContent,
            // Whisper only to the current user
            whisper: [game.user.id],
            type: CONST.CHAT_MESSAGE_TYPES.WHISPER
        }).then(message => {
            console.log("Vestige of Yimyar | Chat message created successfully");
            return message;
        });
        
    } catch (error) {
        console.error("Vestige of Yimyar | Error creating rest report chat message:", error);
        ui.notifications.error("Failed to create rest report: " + error.message);
    }

    console.log("Vestige of Yimyar | Final Rest Values:", {
        initialHP,
        finalHP,
        hpChange: finalHP - initialHP,
        initialTempHP,
        finalTempHP,
        tempHPChange: finalTempHP - initialTempHP
    });
}

// Helper function to restore spell slots manually if needed
async function restoreSpellSlots(actor) {
    // Only process if this is a spellcaster
    if (!actor.spellcasting) return;
    
    const updates = [];
    
    // Get all spellcasting entries
    const spellcastingEntries = actor.itemTypes.spellcastingEntry || [];
    
    for (const entry of spellcastingEntries) {
        // Skip if this isn't a prepared or spontaneous caster
        if (!["prepared", "spontaneous"].includes(entry.system?.cast?.value)) continue;
        
        // Reset spell slots
        const slotGroups = entry.system.slots || {};
        for (const [key, slot] of Object.entries(slotGroups)) {
            if (key.startsWith("slot") && typeof slot.value === "number" && typeof slot.max === "number") {
                updates.push({
                    _id: entry.id,
                    [`system.slots.${key}.value`]: slot.max
                });
            }
        }
    }
    
    // Apply the updates
    if (updates.length > 0) {
        await actor.updateEmbeddedDocuments("Item", updates);
        console.log("Vestige of Yimyar | Restored spell slots");
    }
}

// Helper function to remove the toll effect
async function removeTollEffect(actor) {
    try {
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
    } catch (error) {
        console.error("Vestige of Yimyar | Error removing toll effect:", error);
    }
}