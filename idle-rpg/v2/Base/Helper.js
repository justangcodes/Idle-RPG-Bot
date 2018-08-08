const seedrandom = require('seedrandom');
const enumHelper = require('../../utils/enumHelper');

const RNG = seedrandom();

class Helper {

  /*
    GAME HELPERS
  */

  /**
   * Returns a random number between a min and max
   * Utilizing https://stackoverflow.com/questions/15594332/unbiased-random-range-generator-in-javascript
   * @param {Number} min
   * @param {Number} max
   * @param {Number} decimal
   * @param {Number} exclude
   * @returns {Number}
   */
  randomBetween(min, max, decimal, exclude) {
    // Adding + 1 to max due to trunc
    max += 1;
    if (arguments.length < 2) return (RNG() >= 0.5);

    let factor = 1;
    let result;
    if (typeof decimal === 'number') {
      factor = decimal ** 10;
    }
    do {
      result = (RNG() * (max - min)) + min;
      result = Math.trunc(result * factor) / factor;
    } while (result === exclude);
    return result;
  }

  /**
   * Returns a player name as a String formatted with discords <@!Mention> if player has isMention activated
   * @param {PlayerObj} player
   * @param {Boolean} isAction
   * @returns {String}
   */
  generatePlayerName(player, isAction) {
    if (
      player.isMentionInDiscord === 'off'
      || player.isMentionInDiscord === 'action' && !isAction
      || player.isMentionInDiscord === 'move' && isAction
    ) {
      return player.titles.current !== 'None'
        ? `\`${player.name} the ${player.titles.current}\``
        : `\`${player.name}\``;
    }

    return player.titles.current !== 'None'
      ? `<@!${player.discordId}> the ${player.titles.current}`
      : `<@!${player.discordId}>`;
  }

  /**
   * Based on player setting, transform into the correct gender
   * @param {PlayerObj} player
   * @param {String} word
   * @returns {String}
   */
  generateGenderString(player, word) {
    return enumHelper.genders[player.gender] ? enumHelper.genders[player.gender][word] : word;
  }

  /*
    BATTLE HELPERS
  */
  // TODO: CLEAN THIS UP MAN
  pveMessageFormat(results, updatedPlayer, playerMaxHealth, multiplier) {
    const mobListResult = [];
    const mobListInfo = { mobs: [] };
    let isQuestCompleted = false;
    const eventMsg = [`[\`${results.attacker.map.name}\`] `];
    const eventLog = [];
    let mobCountString = '';
    let mobKillCountString = '';
    let mobFleeCountString = '';
    let expGain = 0;
    let goldGain = 0;
    let questExpGain = 0;
    let questGoldGain = 0;

    results.defender.forEach((mob) => {
      let infoList = mobListInfo.mobs.findIndex(arrayMob => arrayMob.mob === mob.name);
      if (infoList !== -1) {
        mobListInfo.mobs[infoList].totalCount++;
      } else {
        mobListInfo.mobs.push({
          mob: mob.name,
          totalCount: 0,
          event: {
            killed: 0,
            fled: 0,
            survived: 0
          }
        });
      }
      infoList = mobListInfo.mobs.findIndex(arrayMob => arrayMob.mob === mob.name);
      expGain += Math.ceil(((mob.experience) + (mob.dmgDealt / 4)) / 6) * multiplier;

      if (mob.health <= 0) {
        goldGain += Math.floor((mob.gold * multiplier));
        mobListInfo.mobs[infoList].event.killed++;
      } else if (mob.health > 0 && updatedPlayer.health > 0) {
        mobListInfo.mobs[infoList].event.fled++;
        mob.health > updatedPlayer.health ? updatedPlayer.fled.you++ : updatedPlayer.fled.mob++;
      } else if (mob.health > 0 && updatedPlayer.health <= 0) {
        mobListInfo.mobs[infoList].event.survived++;
      }

      if (!updatedPlayer.quest.questMob.name.includes('None') && mob.name.includes(updatedPlayer.quest.questMob.name) && mob.health <= 0) {
        updatedPlayer.quest.questMob.killCount++;
        if (updatedPlayer.quest.questMob.killCount >= updatedPlayer.quest.questMob.count) {
          isQuestCompleted = true;
          questExpGain = Math.ceil((expGain * updatedPlayer.quest.questMob.count) / 2);
          questGoldGain = Math.ceil((goldGain * updatedPlayer.quest.questMob.count) / 2);
          updatedPlayer.quest.questMob.name = 'None';
          updatedPlayer.quest.questMob.count = 0;
          updatedPlayer.quest.questMob.killCount = 0;
          updatedPlayer.quest.completed++;
        }
        updatedPlayer.quest.updated_at = new Date();
      }

      if (Math.floor(results.defenderDamage / (results.defender.length)) > 0) {
        mobListResult.push(`  ${mob.name}'s ${mob.equipment.weapon.name} did ${mob.dmgDealt} damage.`);
      }
      mobListResult.push(`  ${mob.health <= 0 ? `${mob.name} took ${mob.dmgReceived} dmg and died.` : `${mob.name} took ${mob.dmgReceived} dmg and has ${mob.health} / ${mob.maxHealth} HP left.`}`);
    });
    let battleResult = `\`\`\`Battle Results:
  You have ${updatedPlayer.health} / ${playerMaxHealth} HP left.
${mobListResult.join('\n')}\`\`\``;

    if (updatedPlayer.health <= 0) {
      battleResult = battleResult.replace(`  You have ${updatedPlayer.health} / ${playerMaxHealth} HP left.`, '');
      const killerMob = results.defender.map((mob) => {
        if (mob.dmgDealt > 0) {
          return mob.name;
        }

        return '';
      }).join(', ').replace(/,$/g, '');
      eventMsg.push(`| ${killerMob} just killed ${this.generatePlayerName(updatedPlayer, true)}!`);
      eventLog.push(`${killerMob} just killed you!`);
    }
    const eventMsgResults = `↳ ${this.capitalizeFirstLetter(this.generateGenderString(updatedPlayer, 'he'))} dealt \`${results.attackerDamage}\` dmg, received \`${results.defenderDamage}\` dmg and gained \`${expGain}\` exp${goldGain === 0 ? '' : ` and \`${goldGain}\` gold`}! [HP:${updatedPlayer.health}/${playerMaxHealth}]`;

    mobListInfo.mobs.forEach((mobInfo, i) => {
      const totalCount = mobInfo.event.killed + mobInfo.event.fled + mobInfo.event.survived;
      mobCountString = i > 0 ? mobCountString.concat(`, ${totalCount}x \`${mobInfo.mob}\``) : mobCountString.concat(`${totalCount}x \`${mobInfo.mob}\``);
      if (mobInfo.event.killed > 0) {
        mobKillCountString = mobKillCountString !== '' ? mobKillCountString.concat(`, ${mobInfo.event.killed}x \`${mobInfo.mob}\``) : mobKillCountString.concat(`${mobInfo.event.killed}x \`${mobInfo.mob}\``);
      }
      if (mobInfo.event.fled > 0 && mobInfo.event.killed === 0) {
        mobFleeCountString = mobKillCountString !== '' ? mobFleeCountString.concat(`, ${mobInfo.event.fled}x \`${mobInfo.mob}\``) : mobFleeCountString.concat(`${mobInfo.event.fled}x \`${mobInfo.mob}\``);
      } else if (mobInfo.event.fled > 0) {
        mobFleeCountString = mobFleeCountString.concat(`${mobInfo.event.fled}x \`${mobInfo.mob}\``);
      }
    });

    if (mobFleeCountString) {
      eventMsg.push(results.attackerDamage > results.defenderDamage
        ? `${mobFleeCountString} just fled from ${this.generatePlayerName(results.attacker, true)}!`.replace(/1x /g, '')
        : `${this.generatePlayerName(results.attacker, true)} just fled from ${mobFleeCountString}!`.replace(/1x /g, ''));
      eventLog.push(results.attackerDamage > results.defenderDamage
        ? `${mobFleeCountString} fled from you! [${expGain} exp]`.replace(/1x /g, '')
        : `You fled from ${mobFleeCountString}! [${expGain} exp]`.replace(/1x /g, ''));
    }

    if (mobKillCountString) {
      eventMsg.push(`${this.generatePlayerName(updatedPlayer, true)}'s \`${updatedPlayer.equipment.weapon.name}\` just killed ${mobKillCountString}`.replace(/1x /g, ''));
      eventLog.push(`You killed ${mobKillCountString}! [\`${expGain}\` exp${goldGain === 0 ? '' : ` / \`${goldGain}\` gold`}]`.replace(/1x /g, '').replace(/\n$/g, ''));
    }
    const attackedMsg = `Attacked ${mobCountString.replace(/`/g, '')} with \`${updatedPlayer.equipment.weapon.name}\` in \`${updatedPlayer.map.name}\` `.replace(/1x /g, '');
    eventMsg.push(eventMsgResults);
    eventLog.push(attackedMsg.replace(/1x /g, '').concat(battleResult));
    eventMsg.splice(0, 2, eventMsg[0] + eventMsg[1]);

    return {
      updatedPlayer,
      expGain,
      goldGain,
      questExpGain,
      questGoldGain,
      eventMsg,
      eventLog,
      isQuestCompleted
    };
  }

  /*
    GENERAL HELPERS
  */

  /**
   * Returns a codeblock for discord
   * @param {String} message 
   * @returns {String} codeblock
   */
  setImportantMessage(message) {
    return `\`\`\`css\n${message}\`\`\``;
  }

  /**
   * Capitalizes first letter of string
   * @param {String} stringToCapitalize
   * @returns {String}
   */
  capitalizeFirstLetter(stringToCapitalize) {
    return stringToCapitalize.charAt(0).toUpperCase()
      .concat(stringToCapitalize.slice(1));
  }

  /**
   * Verifies if object contains name of nameToCheck
   * @param {Object} obj
   * @param {String} nameToCheck
   * @returns {Boolean}
   */
  objectContainsName(obj, nameToCheck) {
    if (typeof obj !== 'object') {
      throw new Error('obj provided is not an Object!');
    }
    if (typeof nameToCheck !== 'string') {
      throw new Error('nameToCheck provided is not a String!');
    }

    const keyList = Object.keys(obj);
    for (let i = 0; i < keyList.length; i++) {
      if (!keyList.includes('name') && typeof obj[keyList[i]] === 'object') {
        if (this.objectContainsName(obj[keyList[i]], nameToCheck)) {
          return true;
        }
      } else if (obj[keyList[i]] && obj[keyList[i]] === nameToCheck) {
        return true;
      }
    }

    return false;
  }

}
module.exports = Helper;