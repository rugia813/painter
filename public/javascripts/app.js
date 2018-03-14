const config = {
    size: 1,
    color: 'black',
    tool: null,
    width: 1024,
    height: 768
  }
  //drawing canvas
  const canvas = document.querySelector('#canvas')
  canvas.width = config.width
  canvas.height = config.height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  //virtual layer canvas
  const cv = document.querySelector('#canvas_virtual_layer')
  cv.width = config.width
  cv.height = config.height
  const cv_ctx = cv.getContext('2d')
  
  let isDrawing = false
  let lastPoint = []
  let isLocked = false
  let path = []
  
  socket = io.connect();
  
  //tools
  const pathObj = (e) => { return { x: e.offsetX, y: e.offsetY } }
  const emit = (type, _path = path, _config = config) => {
    socket.emit('draw', { 
      tool: type, 
      path: _path, 
      color: _config.color, 
      size: _config.size
    })
    socket.emit('done', null)
    path = []
  }
  const brush = {
    down: (e) => {
      isDrawing = true
      draw(e.offsetX, e.offsetY, ctx, lastPoint)
      path.push(pathObj(e))
      emit('brush')
    },
    up: (e) => {
      isDrawing = false
      path.push(pathObj(e))
      emit('brush')
    },
    move: (e) => {
      if (isDrawing) {
        draw(e.offsetX, e.offsetY, ctx, lastPoint)
        path.push(pathObj({ offsetX: lastPoint[0], offsetY: lastPoint[1] }))
        path.push(pathObj(e))
        emit('brush')
      }
      lastPoint = [e.offsetX, e.offsetY]
    }
  }
  const line = {
    down: (e) => {
      isDrawing = true
      lastPoint = [e.offsetX, e.offsetY]
      draw(e.offsetX, e.offsetY, ctx)
      path.push(pathObj(e))
    },
    up: (e) => {
      isDrawing = false
      clearCanvas(cv_ctx)
      drawLine(lastPoint, [e.offsetX, e.offsetY], ctx)
      draw(e.offsetX, e.offsetY, ctx)
      path.push(pathObj(e))
      emit('line')
      path = []
    },
    move: (e) => {
      if (isDrawing) {
        clearCanvas(cv_ctx)
        drawLine(lastPoint, [e.offsetX, e.offsetY], cv_ctx)
        draw(e.offsetX, e.offsetY, cv_ctx)
      }
    }
  }
  const fill = {
    down: (e) => {
      const color = config.color.split(',')
      draw_fill(ctx, e.offsetX, e.offsetY, color.shift(), color.shift(), color.shift(), color.shift())
      // floodFill(e.x, e.y, config)
      emit('fill', {x: e.offsetX, y: e.offsetY, config})
      path = []
    },
    up: (e) => { },
    move: (e) => { }
  }
  const tools = {
    brush, line, fill
  }

  socket.on('draw', (data) => {
    let { tool, path, color, size } = data
    switch(tool) {
      case 'line':
      case 'brush':
        const prev = path[0];
        const point = path[1] || prev;
        
        draw(prev.x, prev.y, ctx, null, size, color)
        draw(point.x, point.y, ctx, null, size, color)
        
        drawLine([prev.x, prev.y], [point.x, point.y], ctx, size, color)
      break
      case 'fill':
        color = color.split(',')
        draw_fill(ctx, path.x, path.y, color.shift(), color.shift(), color.shift(), color.shift())
      break
      case 'clear':
        clearCanvas()
      break
    }
  });

  //Functions
  function floodFill(x, y, config) {
    if (isLocked) return
    const imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height)
    isLocked = true
    //worker
    const worker = new Worker('javascripts/floodWorker.js')
    worker.postMessage({imgdata, x, y, config: JSON.stringify(config)})
    worker.onmessage = (e) => {
      ctx.putImageData(e.data.imgdata, 0, 0)
      isLocked = false
    }
  }
  
  function setTool(selectedTool) {
    cv.onmousedown = selectedTool.down
    // document.onmouseleave = selectedTool.up
    cv.onmouseup = selectedTool.up
    cv.onmousemove = selectedTool.move
  }
  
  function draw(x, y, ctx, lastPoint = null, size = config.size, color = config.color) {
    ctx.fillStyle = `rgba(${color})`;
    ctx.beginPath()
    ctx.arc(x, y, size / 2, 0, 2 * Math.PI)
    ctx.fill()
    try {
      drawLine(lastPoint || [x, y], [x, y], ctx, size, color) //interpolation
    } catch (e) {}
  }
  
  function drawLine(p1, p2, ctx, size = config.size, color = config.color) {
    ctx.beginPath()
    ctx.moveTo(...p1);
    ctx.lineTo(...p2);
    ctx.lineWidth = size
    ctx.strokeStyle = `rgba(${color})`
    ctx.stroke();
  }
  
  function setColor() {
    let value = document.querySelector('#color_picker').value
    const getColor = (_x, _y) => {
      const pixel = ctx.getImageData(_x, _y, 1, 1)
      return pixel.data.toString()
    }
    const _setColor = (_x, _y, color = config.color) => {
      ctx.fillStyle = color
      ctx.fillRect(_x, _y, 1, 1)
    }
    _setColor(1, 1, value)
    value = getColor(1, 1)
    config.color = value
  }
  
  function setSize() {
    const value = document.querySelector('#size_setter').value
    config.size = value
  }
  
  function pickTool() {
    const value = document.querySelector('#tool_setter').value
    config.tool = tools[value]
    setTool(tools[value])
  }
  
  function clearCanvas(context = ctx) {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }

  function onPressClearCanvas(context = ctx) {
    emit('clear')
    clearCanvas(context)
  }
  function draw_fill(ctx, x, y, fill_r, fill_g, fill_b, fill_a){
	
    // TODO: split up processing in case it takes too long?
    // progress bar and abort button (outside of image-manipulation.js)
    // or at least just free up the main thread every once in a while
    // TODO: speed up with typed arrays? https://hacks.mozilla.org/2011/12/faster-canvas-pixel-manipulation-with-typed-arrays/
    // could avoid endianness issues if only copying colors
    // the jsperf only shows ~15% improvement
    // maybe do something fancier like special-casing large chunks of single-color image
    // (octree? or just have a higher level stack of chunks to fill and check at if a chunk is homogeneous)
  
    var stack = [[x, y]];
    var c_width = canvas.width;
    var c_height = canvas.height;
    var id = ctx.getImageData(0, 0, c_width, c_height);
    pixel_pos = (y*c_width + x) * 4;
    var start_r = id.data[pixel_pos+0];
    var start_g = id.data[pixel_pos+1];
    var start_b = id.data[pixel_pos+2];
    var start_a = id.data[pixel_pos+3];
    
    if(
      fill_r === start_r &&
      fill_g === start_g &&
      fill_b === start_b &&
      fill_a === start_a
    ){
      return;
    }
    
    while(stack.length){
      var new_pos, x, y, pixel_pos, reach_left, reach_right;
      new_pos = stack.pop();
      x = new_pos[0];
      y = new_pos[1];
  
      pixel_pos = (y*c_width + x) * 4;
      while(matches_start_color(pixel_pos)){
        y--;
        pixel_pos = (y*c_width + x) * 4;
      }
      reach_left = false;
      reach_right = false;
      while(true){
        y++;
        pixel_pos = (y*c_width + x) * 4;
        
        if(!(y < c_height && matches_start_color(pixel_pos))){
          break;
        }
        
        color_pixel(pixel_pos);
  
        if(x > 0){
          if(matches_start_color(pixel_pos - 4)){
            if(!reach_left){
              stack.push([x - 1, y]);
              reach_left = true;
            }
          }else if(reach_left){
            reach_left = false;
          }
        }
  
        if(x < c_width-1){
          if(matches_start_color(pixel_pos + 4)){
            if(!reach_right){
              stack.push([x + 1, y]);
              reach_right = true;
            }
          }else if(reach_right){
            reach_right = false;
          }
        }
  
        pixel_pos += c_width * 4;
      }
    }
    ctx.putImageData(id, 0, 0);
  
    function matches_start_color(pixel_pos){
      return (
        id.data[pixel_pos+0] === start_r &&
        id.data[pixel_pos+1] === start_g &&
        id.data[pixel_pos+2] === start_b &&
        id.data[pixel_pos+3] === start_a
      );
    }
  
    function color_pixel(pixel_pos){
      id.data[pixel_pos+0] = fill_r;
      id.data[pixel_pos+1] = fill_g;
      id.data[pixel_pos+2] = fill_b;
      id.data[pixel_pos+3] = fill_a;
    }
  }
  //INIT
  setColor(config.color)
  setSize(config.size)
  pickTool(config.tool)








  