// vibecodea.js - Juego infinito completo con reflejo correcto del perrito
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#001a00',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: { preload, create, update }
};

let player, cursors, humans, monsters, bananas, walls;
let lives = 3, energy = 100, score = 0;
let livesText, energyText, scoreText;
let game;
let lastAttack = 0;
let humanSpawnDelay = 4000;
let monsterSpawnDelay = 7000;
let bananaSpawnDelay = 6000;
let maxMonsters = 1;

window.onload = function() { game = new Phaser.Game(config); };

function preload() {}

function create() {
  const scene = this;
  scene.add.rectangle(400, 300, 800, 600, 0x001a00);

  // laberinto bloques
  walls = scene.physics.add.staticGroup();
  const wallPositions = [
      { x: 150, y: 100, w: 50, h: 50 }, { x: 450, y: 100, w: 50, h: 50 },
      { x: 300, y: 300, w: 50, h: 50 }, { x: 600, y: 400, w: 50, h: 50 },
      { x: 200, y: 450, w: 50, h: 50 }, { x: 500, y: 250, w: 50, h: 50 }
  ];
  wallPositions.forEach(w => {
      const rect = scene.add.rectangle(w.x, w.y, w.w, w.h, 0x004400);
      scene.physics.add.existing(rect, true);
      walls.add(rect);
  });

  // jugador
  player = scene.add.text(120, 120, '🐕', { fontSize: '32px' });
  scene.physics.add.existing(player);
  player.body.setCollideWorldBounds(true);
  player.body.setSize(32,32);
  player.setOrigin(0.5,0.5);
  player.setScale(1,1); // Inicia apuntando a la izquierda

  // grupos
  humans = scene.physics.add.group();
  monsters = scene.physics.add.group();
  bananas = scene.physics.add.group();

  // spawn inicial: jugador + humano
  spawnHuman(scene);

  // UI
  livesText = scene.add.text(10, 30, 'Vidas: ' + lives, { fontSize: '18px', fill: '#fff' });
  energyText = scene.add.text(10, 50, 'Energía: ' + Math.floor(energy), { fontSize: '18px', fill: '#fff' });
  scoreText = scene.add.text(10, 10, 'Puntos: ' + score, { fontSize: '18px', fill: '#fff' });

  // controles WASD
  cursors = scene.input.keyboard.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D', space: 'SPACE'
  });
  scene.input.keyboard.on('keydown-SPACE', () => attack(scene));

  // colisiones
  scene.physics.add.collider(player, walls);
  scene.physics.add.collider(monsters, walls);
  scene.physics.add.collider(humans, walls);
  scene.physics.add.collider(bananas, walls);

  // overlaps
  scene.physics.add.overlap(player, humans, (p,h) => rescueHuman(scene,h));
  scene.physics.add.overlap(player, bananas, (p,b) => collectBanana(scene,b));
  scene.physics.add.overlap(player, monsters, (p,m) => hitMonster(scene,m));

  // spawn continuo
  scene.time.addEvent({ delay: humanSpawnDelay, loop: true, callback: () => spawnHuman(scene) });
  scene.time.addEvent({ delay: monsterSpawnDelay, loop: true, callback: () => {
      if (monsters.getLength() < maxMonsters) spawnMonster(scene);
  }});
  scene.time.addEvent({ delay: bananaSpawnDelay, loop: true, callback: () => spawnBanana(scene) });
}

// temporizador de humanos
let deltaAccumulator = 0;
function update(time, delta) {
  if (!player.body) return;

  // movimiento
  player.body.setVelocity(0);
  if (cursors.left.isDown) { 
      player.body.setVelocityX(-200); 
      player.setScale(1,1); // apunta a la izquierda
  } else if (cursors.right.isDown) { 
      player.body.setVelocityX(200); 
      player.setScale(-1,1); // apunta a la derecha
  }
  if (cursors.up.isDown) player.body.setVelocityY(-200);
  else if (cursors.down.isDown) player.body.setVelocityY(200);
  if ((cursors.left.isDown||cursors.right.isDown) && (cursors.up.isDown||cursors.down.isDown))
      player.body.velocity.normalize().scale(200);

  // energía pasiva
  if (energy < 100) energy += 0.05;
  energyText.setText('Energía: ' + Math.floor(energy));

  // decremento temporizador humanos
  deltaAccumulator += delta;
  if(deltaAccumulator >= 16){
      humans.getChildren().slice().forEach(h => {
          if (!h.active) return;
          if (!h.timer) {
              if (score >= 500) h.timer = 5;
              else if (score >= 400) h.timer = 6;
              else if (score >= 300) h.timer = 7;
              else h.timer = 8;
          }
          h.timer = Math.max(0, h.timer - deltaAccumulator/1000);

          if (!h.timerText) h.timerText = h.scene.add.text(h.x,h.y-20,Math.ceil(h.timer),{fontSize:'16px',fill:'#00ff00'}).setOrigin(0.5);
          h.timerText.setText(Math.ceil(h.timer));
          h.timerText.setColor(h.timer<=3?'#ff0000':'#00ff00');
          h.timerText.visible = h.timer>0 && (h.timer<=3 ? Math.floor(Date.now()/200)%2===0 : true);

          if (h.timer <= 0) {
              if(h.timerText){ h.timerText.destroy(); h.timerText=null; }
              let m = h.scene.add.text(h.x,h.y,'🧟‍♀️',{fontSize:'32px'});
              h.scene.physics.add.existing(m);
              m.body.setCollideWorldBounds(true);
              m.body.setSize(32,32);
              monsters.add(m);
              score = Math.max(0, score-50);
              scoreText.setText('Puntos: ' + score);
              h.destroy();
          }
      });
      deltaAccumulator = 0;
  }

  // monstruos
  monsters.getChildren().forEach(m => {
      if (!m.body) return;
      if (!m.nextTargetTime) m.nextTargetTime = 0;
      if (game.scene.scenes[0].time.now > m.nextTargetTime) {
          m.nextTargetTime = game.scene.scenes[0].time.now + 500;
          let closest = null, minDist = 9999;
          humans.getChildren().forEach(h => {
              if (!h.active) return;
              const d = Phaser.Math.Distance.Between(m.x,m.y,h.x,h.y);
              if (d < minDist) { minDist=d; closest=h; }
          });
          const dPlayer = Phaser.Math.Distance.Between(m.x,m.y,player.x,player.y);
          if (dPlayer < minDist) { minDist=dPlayer; closest=player; }

          if (closest) {
              let dx = closest.x - m.x, dy = closest.y - m.y;
              m.body.setVelocity(dx*0.6, dy*0.6);
              if (humans.contains(closest) && Phaser.Math.Distance.Between(m.x,m.y,closest.x,closest.y)<20) {
                  if(closest.timerText){ closest.timerText.destroy(); closest.timerText=null; }
                  let mm = m.scene.add.text(closest.x,closest.y,'🧟‍♀️',{fontSize:'32px'});
                  m.scene.physics.add.existing(mm);
                  mm.body.setCollideWorldBounds(true);
                  mm.body.setSize(32,32);
                  monsters.add(mm);
                  score = Math.max(0, score-50);
                  scoreText.setText('Puntos: ' + score);
                  closest.destroy();
              }
          } else m.body.setVelocity(0);
      }
  });
}

// ataque
function attack(scene){
  const now = Date.now();
  if (now - lastAttack < 700) return;
  if (energy < 30) return;
  lastAttack = now;
  energy -= 30;
  energyText.setText('Energía: ' + Math.floor(energy));

  const wave = scene.add.circle(player.x,player.y,60,0xffff00,0.18);
  scene.tweens.add({ targets: wave, alpha:0, duration:350, onComplete:()=>wave.destroy() });

  monsters.getChildren().slice().forEach(m=>{
      const d = Phaser.Math.Distance.Between(player.x,player.y,m.x,m.y);
      if(d<=60){ 
          m.destroy(); 
          score += 30; 
          scoreText.setText('Puntos: '+score); 
      }
  });
}

// spawn humano
function spawnHuman(scene){
  let pos = getFreePosition(scene);
  let h = scene.add.text(pos.x,pos.y,'🧍',{ fontSize:'32px' });
  scene.physics.add.existing(h);
  h.body.setCollideWorldBounds(true);
  h.body.setSize(32,32);
  humans.add(h);
}

// spawn monstruo
function spawnMonster(scene){
  let pos = getFreePosition(scene);
  let m = scene.add.text(pos.x,pos.y,'🧟‍♀️',{ fontSize:'32px' });
  scene.physics.add.existing(m);
  m.body.setCollideWorldBounds(true);
  m.body.setSize(32,32);
  monsters.add(m);
}

// spawn plátano/bomba
function spawnBanana(scene){
  let pos = getFreePosition(scene);
  let isBomb = score>=200 && Math.random()<0.3;
  let b = scene.add.text(pos.x,pos.y,isBomb?'💣':'🍌',{ fontSize:'32px' });
  scene.physics.add.existing(b);
  b.body.setImmovable(true);
  bananas.add(b);
  if(isBomb){
      scene.physics.add.overlap(player,b,()=>{
          b.destroy();
          lives = Math.max(0,lives-1);
          livesText.setText('Vidas: '+lives);
          if(lives<=0) gameOver(scene);
      });
  }
}

// rescatar humano
function rescueHuman(scene,h){
  if(h.timerText) h.timerText.destroy();
  h.destroy();
  lives = Math.min(5,lives+1);
  score += 50;
  livesText.setText('Vidas: '+lives);
  scoreText.setText('Puntos: '+score);
}

// recoger plátano
function collectBanana(scene,b){
  b.destroy();
  energy = Math.min(100,energy+20);
  energyText.setText('Energía: '+Math.floor(energy));
  score += 20;
  scoreText.setText('Puntos: '+score);
}

// ser tocado por monstruo
function hitMonster(scene,m){
  m.destroy();
  lives = Math.max(0,lives-1);
  livesText.setText('Vidas: '+lives);
  score = Math.max(0,score-20);
  scoreText.setText('Puntos: '+score);
  if(lives<=0) gameOver(scene);
}

// game over
function gameOver(scene){
  const msg = scene.add.text(400,300,'GAME OVER',{fontSize:'48px',fill:'#ff4444'}).setOrigin(0.5);
  player.body.setVelocity(0);
  scene.time.addEvent({ delay:3000, callback:()=>{ scene.scene.restart(); } });
}

// posición libre
function getFreePosition(scene){
  let x,y,tries=0;
  do{
      x = Phaser.Math.Between(50,750);
      y = Phaser.Math.Between(50,550);
      tries++;
      if(tries>80) break;
  }while(walls.getChildren().some(w=>Phaser.Geom.Intersects.RectangleToRectangle(
      new Phaser.Geom.Rectangle(x-16,y-16,32,32),w.getBounds()
  )));
  return {x,y};
}
