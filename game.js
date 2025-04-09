// Phaser 3 예제 코드
// 요구사항: 
// - 최신 Phaser 버전 사용 (모바일 대응, RESIZE 설정 포함)
// - 검은색 배경에 별들이 있는 우주 배경이 우측으로 스크롤
// - 좌측 고정된 우주선은 타원형 모양 (앞쪽은 붉은색, 나머지는 회색)
// - 터치(혹은 마우스 클릭) 시 기준점을 잡고, 손가락(또는 마우스) 이동에 따라 우주선의 Y 위치와 회전(레버처럼)이 부드럽게 조절됨
// - 터치를 떼면 우주선은 화면 중앙 Y와 기본 회전(0, 오른쪽을 향함)으로 부드럽게 복귀하며, 트레일은 즉시 사라짐

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    scale: {
         mode: Phaser.Scale.RESIZE,
         autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);

// 전역 변수들
let spaceship;
let bg;
let emitter;
let pointerActive = false;
let pointerOrigin = { x: 0, y: 0 };
let spaceshipStartY;
const BG_SCROLL_SPEED = 1; // 배경 스크롤 속도

function preload() {
    // 우주선, 파티클, 배경 텍스쳐 생성 함수 호출
    createSpaceshipTexture(this);
    createParticleTexture(this);
    createBackgroundTexture(this);
}

function createSpaceshipTexture(scene) {
    // 우주선 텍스쳐 생성 (60x30 크기의 타원, 오른쪽 절반은 빨간색, 나머지는 회색)
    const width = 60;
    const height = 30;
    const center = { x: width / 2, y: height / 2 };
    const rX = width / 2;
    const rY = height / 2;
    let gfx = scene.make.graphics({ x: 0, y: 0, add: false });

    // 전체 타원을 회색으로 채움
    gfx.fillStyle(0x808080, 1);
    gfx.fillEllipse(center.x, center.y, width, height);

    // 오른쪽 반원(타원)을 빨간색으로 채움
    gfx.fillStyle(0xff0000, 1);
    let points = [];
    // 오른쪽 반원의 경계는 (center.x, center.y - rY)에서 시작하여
    // 각도 -90도 ~ 90도에 해당하는 타원 곡선을 따라가고, (center.x, center.y + rY)로 닫힘.
    points.push(new Phaser.Math.Vector2(center.x, center.y - rY));
    const numPoints = 30;
    for (let i = 0; i <= numPoints; i++) {
        let angle = -Math.PI / 2 + (i * Math.PI) / numPoints;
        let x = center.x + rX * Math.cos(angle);
        let y = center.y + rY * Math.sin(angle);
        points.push(new Phaser.Math.Vector2(x, y));
    }
    points.push(new Phaser.Math.Vector2(center.x, center.y + rY));

    gfx.beginPath();
    gfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        gfx.lineTo(points[i].x, points[i].y);
    }
    gfx.closePath();
    gfx.fillPath();

    // 텍스쳐 생성 후 Graphics 객체 삭제
    gfx.generateTexture('spaceship', width, height);
    gfx.destroy();
}

function createParticleTexture(scene) {
    // 작은 흰색 원을 파티클 텍스쳐로 생성 (8x8)
    let gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(4, 4, 4);
    gfx.generateTexture('particle', 8, 8);
    gfx.destroy();
}

function createBackgroundTexture(scene) {
    // 게임 크기에 맞추어 검은 배경과 별들이 있는 우주 배경 텍스쳐 생성
    const width = scene.sys.game.config.width;
    const height = scene.sys.game.config.height;
    let gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(0x000000, 1);
    gfx.fillRect(0, 0, width, height);
    // 랜덤한 별들을 그림
    for (let i = 0; i < 100; i++) {
        let x = Phaser.Math.Between(0, width);
        let y = Phaser.Math.Between(0, height);
        let starRadius = Phaser.Math.Between(1, 3);
        gfx.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.5, 1));
        gfx.fillCircle(x, y, starRadius);
    }
    gfx.generateTexture('spaceBg', width, height);
    gfx.destroy();
}

function create() {
    const scene = this;
    const gameWidth = scene.sys.game.config.width;
    const gameHeight = scene.sys.game.config.height;

    // 배경 타일 스프라이트 추가 (우측으로 스크롤)
    bg = scene.add.tileSprite(0, 0, gameWidth, gameHeight, 'spaceBg');
    bg.setOrigin(0, 0);

    // 우주선 스프라이트 추가 (x 위치는 고정, y는 중앙)
    spaceship = scene.add.sprite(100, gameHeight / 2, 'spaceship');
    spaceship.setOrigin(0.5, 0.5);
    spaceshipStartY = spaceship.y; // 기본 Y 위치(중앙)

    // 입력 처리 : pointerdown, pointermove, pointerup
    scene.input.on('pointerdown', function (pointer) {
        pointerActive = true;
        pointerOrigin.x = pointer.x;
        pointerOrigin.y = pointer.y;
        spaceshipStartY = spaceship.y;  // 터치 시작 시의 y 위치 기록

        // 파티클 트레일 시작
        if (emitter) {
            emitter.start();
        }
    });

    scene.input.on('pointermove', function (pointer) {
        if (!pointerActive) return;
        let offsetX = pointer.x - pointerOrigin.x;
        let offsetY = pointer.y - pointerOrigin.y;

        // 터치 오프셋에 따라 우주선의 Y 위치 업데이트 (10% 위/아래 제한)
        let targetY = spaceshipStartY + offsetY;
        let minY = gameHeight * 0.1;
        let maxY = gameHeight * 0.9;
        targetY = Phaser.Math.Clamp(targetY, minY, maxY);
        spaceship.y = Phaser.Math.Linear(spaceship.y, targetY, 0.2);

        // 기준점으로부터의 벡터를 통해 원하는 회전 각도 계산
        // (마치 원형판의 레버가 돌아가는 것처럼)
        let targetAngle = Math.atan2(offsetY, offsetX);
        spaceship.rotation = Phaser.Math.Angle.RotateTo(spaceship.rotation, targetAngle, 0.1);
    });

    scene.input.on('pointerup', function (pointer) {
        pointerActive = false;
        // 터치 해제 시 우주선 위치와 회전을 기본값으로 되돌리도록 Tween 실행
        scene.tweens.add({
            targets: spaceship,
            y: gameHeight / 2,
            rotation: 0, // 기본 회전: 오른쪽을 향함 (0 라디안)
            duration: 300,
            ease: 'Power2'
        });
        // 파티클 트레일 중지(터치 떼면 즉시 사라지도록)
        if (emitter) {
            emitter.stop();
        }
    });

    // 파티클 시스템 생성: 우주선의 꽁무니(후방)에서 발사되는 효과
    let particles = scene.add.particles('particle');
    emitter = particles.createEmitter({
        speed: { min: 50, max: 100 },
        lifespan: 300,
        blendMode: 'ADD',
        scale: { start: 0.5, end: 0 },
        on: false, // 초기에는 비활성화
        frequency: 50
    });
    // 우주선에 고정되도록 follow 설정 (왼쪽으로 오프셋: spaceship의 폭의 절반 정도)
    emitter.startFollow(spaceship, -30, 0);
}

function update() {
    // 배경 타일 스프라이트의 tilePosition.x 를 증가시켜 우측 스크롤 효과 구현
    bg.tilePositionX += BG_SCROLL_SPEED;
}
