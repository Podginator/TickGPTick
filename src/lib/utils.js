const { max, map, get } = require('lodash')

const getExpandedNumberFromTags = tags => {
  return max(map(tags, tag => get(tag.match(/-(\d+)$/), 1))) || 5
}

module.exports = { getExpandedNumberFromTags }
