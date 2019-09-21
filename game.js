var Key = {
  _pressed: {},

  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  FULSCREEN: 70,

  isDown: function(keyCode) {
    return this._pressed[keyCode];
  },

  onKeydown: function(event) {
    this._pressed[event.keyCode] = true;
  },

  onKeyup: function(event) {
    delete this._pressed[event.keyCode];
  }
};
    
window.addEventListener('keyup', function(event) { Key.onKeyup(event); }, false);
window.addEventListener('keydown', function(event) { Key.onKeydown(event); }, false);

var Game = {
  fps: 60,
  width: 640,
  height: 480
};

Game._onEachFrame = (function() {
  var requestAnimationFrame = window.requestAnimationFrame;

  if (requestAnimationFrame) {
   return function(cb) {
      var _cb = function() { cb(); requestAnimationFrame(_cb); }
      _cb();
    };
  } else {
    return function(cb) {
      setInterval(cb, 1000 / Game.fps);
    }
  }
})();

Game.start = function() {
  Game.canvas = document.createElement("canvas");
  Game.canvas.width = Game.width;
  Game.canvas.height = Game.height;

  Game.context = Game.canvas.getContext("2d");
  Game.canvasData =  Game.context.getImageData(0, 0, Game.canvas.width, Game.canvas.height);

  document.body.appendChild(Game.canvas);

  Game.player = new Player();

  Game.mapWalls = 
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,0,0,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];

  Game.mapSizeX = 6;
  Game.mapSizeY = 14;

  Game.TILE_SIZE = 64;
  Game.drawDist = 20;

  Game.loadTextures();
  Game._onEachFrame(Game.run);
};

Game.loadTextures = function() {
  var wallImg = document.getElementById('wallImg');
  Game.context.drawImage(wallImg, 0, 0);
  var wallTexture = Game.context.getImageData(0, 0, Game.TILE_SIZE, Game.TILE_SIZE);
  Game.wallTexture = wallTexture.data;
}

Game.run = (function() {
  var loops = 0, skipTicks = 1000 / Game.fps,
      maxFrameSkip = 10,
      nextGameTick = (new Date).getTime(),
      lastGameTick;

  return function() {
    loops = 0;

    while ((new Date).getTime() > nextGameTick) {
      Game.update();
      nextGameTick += skipTicks;
      loops++;
    }
    Game.timeDelta = (new Date().getTime() - lastGameTick)/1000;
    lastGameTick = new Date().getTime();
    Game.realFPS = 1/Game.timeDelta;
    if (loops) Game.draw();
  }
})();

Game.draw = function() {
  Game.context.fillStyle="black";
  Game.context.fillRect(0, 0, Game.width, Game.height);
  Game.canvasData=Game.context.getImageData(0, 0, Game.width, Game.height);
  Game.context.putImageData(Game.canvasData,0,0);
  for(var x = 0; x < Game.canvas.width; x++) {
    //calculate ray position and direction
    var cameraX = 2 * x / Game.canvas.width - 1; //x-coordinate in camera space
    var rayPosX = Game.player.posX;
    var rayPosY = Game.player.posY;
    var rayDirX = Game.player.dirX + Game.player.planeX * cameraX;
    var rayDirY = Game.player.dirY + Game.player.planeY * cameraX;

    //which box of the map we're in
    var mapX = Math.floor(rayPosX);
    var mapY = Math.floor(rayPosY);

    //length of ray from current position to next x or y-side
    var sideDistX;
    var sideDistY;
    
    //length of ray from one x or y-side to next x or y-side
    var deltaDistX = Math.sqrt(1 + (rayDirY * rayDirY) / (rayDirX * rayDirX));
    var deltaDistY = Math.sqrt(1 + (rayDirX * rayDirX) / (rayDirY * rayDirY));
    
    //what direction to step in x or y-direction (either +1 or -1)
    var stepX;
    var stepY;
    
    var wallHit = 0; //was there a wall hit?
    var side; //was a NS or a EW wall hit?

    //calculate step and initial sideDist
    if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (rayPosX - mapX) * deltaDistX;
    }
    else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - rayPosX) * deltaDistX;
    }
    if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (rayPosY - mapY) * deltaDistY;
    }
    else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - rayPosY) * deltaDistY;
    }
    
    //perform DDA
    while (wallHit == 0) {
        //jump to next map square, OR in x-direction, OR in y-direction
        if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
        }
        else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
        }
        
        //Check if the ray is outside of map bounds
        if (mapX < 0 || mapY < 0 || mapX > Game.mapSizeX-1 || mapY > Game.mapSizeY-1) {break}
        
        //Check if ray has hit a wall
        if (Game.mapWalls[mapX][mapY] > 0) wallHit = 1;
        
        //Chek if we have reached maximum draw distance
        if(Math.abs(mapX - rayPosX) >  Game.drawDist || Math.abs(mapY - rayPosY) > Game.drawDist) {break}
    }
    
    //Calculate distance projected on camera direction (oblique distance will give fisheye effect!)
    if (side == 0) {
        perpWallDist = (mapX - rayPosX + (1 - stepX) / 2) / rayDirX;
    } else {
        perpWallDist = (mapY - rayPosY + (1 - stepY) / 2) / rayDirY;
    }
   
    //Calculate height of line to draw on screen
    var lineHeight = Game.canvas.height / perpWallDist;
    
    //calculate lowest and highest pixel to fill in current stripe
    var drawStart = -lineHeight / 2 + Game.canvas.height / 2;
    
    if(drawStart < 0) drawStart = 0;
    var drawEnd = lineHeight / 2 + Game.canvas.height / 2;
    if(drawEnd >= Game.canvas.height) drawEnd = Game.canvas.height;

    //calculate value of wallX
    var wallX; //where exactly the wall was hit
    if (side == 0) {
        wallX = rayPosY + perpWallDist * rayDirY;
    }
    else {
        wallX = rayPosX + perpWallDist * rayDirX;
    };
    wallX -= Math.floor((wallX));
        
    if (wallHit) {
      //x coordinate on the texture
      var texX = parseInt(wallX * Game.TILE_SIZE);
      if(side == 0 && rayDirX > 0) texX = Game.TILE_SIZE - texX - 1;
      if(side == 1 && rayDirY < 0) texX = Game.TILE_SIZE - texX - 1;           

      for(var y = drawStart; y<drawEnd; y++) {
        var d = y * 256 - Game.canvas.height * 128 + lineHeight * 128;  //256 and 128 factors to avoid floats
        var texY = parseInt(((d * Game.TILE_SIZE) / lineHeight) / 256);

        var red = Game.wallTexture[((Game.TILE_SIZE * texY) + texX) * 4];
        var green = Game.wallTexture[((Game.TILE_SIZE * texY) + texX) * 4 + 1];
        var blue = Game.wallTexture[((Game.TILE_SIZE * texY) + texX) * 4 + 2];
        var alpha = Game.wallTexture[((Game.TILE_SIZE * texY) + texX) * 4 + 3];

        if(side == 1) {
          red = (red >> 1) & 127;
          green = (green >> 1) & 127;
          blue = (blue >> 1) & 127;
        }
        drawPixel(x, parseInt(y), red, green, blue, alpha);
      }
    }
  }
  Game.context.putImageData(Game.canvasData, 0, 0);
  Game.context.fillStyle="white";
  Game.context.fillText("FPS: " + parseInt(Game.realFPS), 8, 8); 
};

Game.update = function() {
  Game.player.update();
};

function Player() {
  this.FOV = 66 * Math.PI / 180;
  this.planeX = 0;
  this.planeY = Math.tan(this.FOV / 2) //the 2d raycaster version of camera plane
  this.posX = 0.5;
  this.posY = 2.5;  //x and y start position
  this.dirX = 1;
  this.dirY = 0; //initial direction vector
}

Player.prototype.turnLeft = function() {
  oldDirX = this.dirX;
  this.dirX = this.dirX * Math.cos(-this.turnSpeed) - this.dirY * Math.sin(-this.turnSpeed);
  this.dirY = oldDirX * Math.sin(-this.turnSpeed) + this.dirY * Math.cos(-this.turnSpeed);
  oldPlaneX = this.planeX;
  this.planeX = this.planeX * Math.cos(-this.turnSpeed) - this.planeY * Math.sin(-this.turnSpeed);
  this.planeY = oldPlaneX * Math.sin(-this.turnSpeed) + this.planeY * Math.cos(-this.turnSpeed);
};

Player.prototype.turnRight = function() {
  oldDirX = this.dirX;
  this.dirX = this.dirX * Math.cos(this.turnSpeed) - this.dirY * Math.sin(this.turnSpeed);
  this.dirY = oldDirX * Math.sin(this.turnSpeed) + this.dirY * Math.cos(this.turnSpeed);
  oldPlaneX = this.planeX;
  this.planeX = this.planeX * Math.cos(this.turnSpeed) - this.planeY * Math.sin(this.turnSpeed);
  this.planeY = oldPlaneX * Math.sin(this.turnSpeed) + this.planeY * Math.cos(this.turnSpeed);
};

Player.prototype.moveUp = function() { 
    this.posX = this.posX + this.dirX * this.moveSpeed;
    this.posY = this.posY + this.dirY * this.moveSpeed;
};

Player.prototype.moveDown = function() {
    this.posX = this.posX - this.dirX * this.moveSpeed;
    this.posY = this.posY - this.dirY * this.moveSpeed;
};

Player.prototype.update = function() {
  this.moveSpeed = Game.timeDelta * 2.0;
  this.turnSpeed = Game.timeDelta * Math.PI/2;
  if (Key.isDown(Key.LEFT)) this.turnLeft();
  if (Key.isDown(Key.RIGHT)) this.turnRight();
  if (Key.isDown(Key.UP)) this.moveUp();
  if (Key.isDown(Key.DOWN)) this.moveDown();
  if (Key.isDown(Key.FULSCREEN)) {
  	if( Game.canvas.webkitRequestFullScreen) {
	  Game.canvas.webkitRequestFullScreen();
	}
	else {
	  Game.canvas.mozRequestFullScreen();
	}
  }
};

drawPixel = function (x, y, r, g, b, a) {
    var index = (x + y * Game.canvas.width) * 4;
    Game.canvasData.data[index + 0] = r;
    Game.canvasData.data[index + 1] = g;
    Game.canvasData.data[index + 2] = b;
    Game.canvasData.data[index + 3] = a;
}