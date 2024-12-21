function pickRandom(list) {
	return list[Math.floor(list.length * Math.random())]
} 

module.exports = { pickRandom }