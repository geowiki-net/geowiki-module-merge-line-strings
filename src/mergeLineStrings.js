import twig from 'twig'

function getAllLineStrings (geometry) {
  let lines = []
  let other = []

  switch (geometry.type.toLowerCase()) {
    case 'linestring':
      lines.push(geometry.coordinates)
      break
    case 'multilinestring':
      lines = lines.concat(geometry.coordinates)
      break
    case 'geometrycollection':
      geometry.geometries.forEach(geom => {
        const [l, o] = getAllLineStrings(geom)

        lines = lines.concat(l)
        other = other.concat(o)
      })
      break
    default:
      other.push(geometry)
  }

  return [lines, other]
}

function findEndPoints (lines) {
  const endPoints = {}

  lines.forEach((line, i) => {
    const start = JSON.stringify(line[0])
    const end = JSON.stringify(line[line.length - 1])

    if (!(start in endPoints)) {
      endPoints[start] = []
    }
    if (!(end in endPoints)) {
      endPoints[end] = []
    }

    endPoints[start].push([i, 0])
    endPoints[end].push([i, 1])
  })

  return endPoints
}

function _mergeable (lineIdx) {
  if (lineIdx.length < 2) {
    return false
  }

  if (lineIdx[0][0] === lineIdx[1][0]) {
    return false
  }

  return true
}

function mergeLineStrings (geometry) {
  let [lines, other] = getAllLineStrings(geometry)

  let endPointsMergeable
  do {
    const endPoints = findEndPoints(lines)
    endPointsMergeable = Object.entries(endPoints).filter(([id, lineIdx]) => _mergeable(lineIdx))
    if (endPointsMergeable.length) {
      const lineIdx = endPointsMergeable[0][1]

      // TODO: choose lines with angle close to 180 degrees
      const l0 = 0
      const l1 = 1
      const line0 = lines[lineIdx[l0][0]]
      const line1 = lines[lineIdx[l1][0]]

      if (lineIdx[l0][1] === 1 && lineIdx[l1][1] === 0) {
        lines[lineIdx[l0][0]] = line0.concat(line1.slice(1))
      } else if (lineIdx[l0][1] === 0 && lineIdx[l1][1] === 1) {
        lines[lineIdx[l0][0]] = line1.concat(line0.slice(1))
      } else if (lineIdx[l0][1] === 0 && lineIdx[l1][1] === 0) {
        lines[lineIdx[l0][0]] = line1.reverse().concat(line0.slice(1))
      } else {
        lines[lineIdx[l0][0]] = line0.concat(line1.reverse().slice(1))
      }

      lines.splice(lineIdx[l1][0], 1)
    }
  } while (endPointsMergeable.length)

  if (lines.length === 0) {
    lines = null
  } else if (lines.length === 1) {
    lines = {
      type: 'LineString',
      coordinates: lines[0]
    }
  } else {
    lines = {
      type: 'MultiLineString',
      coordinates: lines
    }
  }

  if (other.length === 0) {
    return lines
  }
  if (other.length === 1) {
    if (lines) {
      return {
        type: 'GeometryCollection',
        geometries: [lines, other[0]]
      }
    } else {
      return other[0]
    }
  }

  if (lines) {
    return {
      type: 'GeometryCollection',
      geometries: other.concat([lines])
    }
  } else {
    return {
      type: 'GeometryCollection',
      geometries: other
    }
  }
}

twig.extendFilter('mergeLineStrings', function (value, param) { 
  let geometry = JSON.parse(value) 
 
  geometry = mergeLineStrings(geometry) 
 
  return twig.filters.raw(JSON.stringify(geometry)) 
})
