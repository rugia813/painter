onmessage = (e) => {
    let {imgdata, x, y, config} = e.data
    config = JSON.parse(config)
    imgdata = floodFill(imgdata, x, y, config)
    // postMessage(e.data)
    postMessage({imgdata})
  }
  
  function floodFill(imgdata, x, y, config) {
    const data = imgdata.data
    const getCordBaseIdx = (_x, _y) => {
      return ((config.width * 4) * _y) + (4 * _x)
    }
    const getColor = (_x, _y) => {
      const baseIdx = getCordBaseIdx(_x, _y)
      const color = [
        data[baseIdx],
        data[baseIdx + 1],
        data[baseIdx + 2],
        data[baseIdx + 3]
      ]
      return color.toString()
    }
    const setColor = (_x, _y, color = config.color) => {
      const rgba = color.split(',')
      const baseIdx = getCordBaseIdx(_x, _y)
      data[baseIdx] = rgba[0]
      data[baseIdx + 1] = rgba[1]
      data[baseIdx + 2] = rgba[2]
      data[baseIdx + 3] = rgba[3]
    }
    let srcColor = getColor(x, y)
    const tarColor = config.color
    if (srcColor === tarColor) return imgdata
  
    let queue = {}
  
    const checkInCanvas = (_x, _y) => {
      return _x >= 0 && _x < config.width && _y >= 0 && _y < config.height
    }
  
    const spread = (_x, _y) => {
      const up = [_x, _y - 1]
      const right = [_x + 1, _y]
      const down = [_x, _y + 1]
      const left = [_x - 1, _y]
      const directions = [up, right, down, left]
  
      directions.forEach((e, i) => {
        const [ex, ey] = [e[0], e[1]]
        const key = [ex, ey].join(',')
        if (queue[key]) return
        if (getColor(ex, ey) === srcColor && checkInCanvas(_x, _y)) {
          setColor(ex, ey)
          queue[key] = 1
        }
      })
    }
  
    setColor(x, y)
    spread(x, y)
    let c = 0
    const rec = () => {
      const qKeys = Object.keys(queue)
      if (qKeys.length > 0) {
        queue = []
        qKeys.forEach((e) => {
          const cord = e.split(',')
          spread(+cord[0], +cord[1])
        })
        c++
        rec()
      }
    }
    rec()
    return imgdata
  }