
// TODO - Upgrade to new code

/* 
export createStrafingBot(target, me, interval, strafeTicks, aimbot, angleOffset) => {
    let ticksLeft = 0;
    return { 
        off: false,
        interval: interval,
        func: function (controller) {
            if (me.off) return;
            if (this.off) {
                me.horizontal = 0;
                return;
            }
            ticksLeft -= 1;
            if (ticksLeft < 0)
                ticksLeft = 0;
            if (me.horizontal === 0) {
                me.horizontal = 1;
            } else if (ticksLeft === 0) {
                me.horizontal *= -1;
                ticksLeft = Math.max(strafeTicks * Math.random(), strafeTicks / 2);
            }
            if (aimbot) {
                let aim = Calcs.aimbot(target.x + target.radius, target.y + target.radius,
                    me.x + me.radius, me.y + me.radius, target.vx, target.vy, me.weapon.speed);
            } else {
                let aim = { x: target.x - me.x, y: target.y - me.y };
            }
            let angle = Math.random() * angleOffset - (angleOffset / 2);
            aim.x = Math.cos(angle) * aim.x - Math.sin(angle) * aim.y;
            aim.y = Math.sin(angle) * aim.x + Math.cos(angle) * aim.y;
            me.aimX = aim.x;
            me.aimY = aim.y;
        }
    };
};

export createDuelBot(target, me, interval, fps, shootDist) => {
    let GAP = 2;
    let dotToDodge = null;

    let isUnavoidable = function (strafe, dot, d) {
        let p2 = Calcs.posOnReverse(me.x, me.y, strafe[0], strafe[1], me.movementAccelMag,
            me.maxSpeed, d, fps);
        let dx2 = dot.vx * d + dot.x;
        let dy2 = dot.vy * d + dot.y;
        let result = Calcs.dotRectCollision(dx2, dy2, 
            p2[0] - GAP, p2[1] - GAP,
            p2[0] + me.width + GAP, p2[1] + me.height + GAP);
        return result;
    };

    let getStrafeDir = function (dot) {
        let strafeX = -dot.vx;
        let strafeY = -dot.vy;
        let mag = Calcs.magnitude(strafeX, strafeY);
        if (mag === 0) {
            strafeX = 0;
            strafeY = 0;
        } else {
            strafeX /= mag;
            strafeY /= mag;
        }
        if (me.horizontal === 0) me.horizontal === 1;
        if (me.horizontal === 1) {
            let temp = strafeX;
            strafeX = strafeY;
            strafeY = -temp;
        } else if (me.horizontal === -1) {
            let temp = strafeX;
            strafeX = -strafeY;
            strafeY = temp;
        }
        strafeX *= me.maxSpeed;
        strafeY *= me.maxSpeed;
        return [strafeX, strafeY];
    };

    return {
        off: false,
        interval: interval,
        func: function (controller) {
            if (me.off) return;
            let fightDist = Calcs.magnitude(target.x - me.x, target.y - me.y);
            if (fightDist <= shootDist * 0.8) {
                me.vertical = 0;
            } else if (dotToDodge === null) {
                me.vertical = 1;
            } 
            if (fightDist <= shootDist) {
                me.firing = true;
            } else {
                me.firing = false;
            }

            let newX = me.x - GAP;
            let newY = me.y - GAP;
            let newX2 = me.x + me.width + GAP;
            let newY2 = me.y + me.height + GAP;

            if (dotToDodge !== null) {
                let dodged = (function () { 
                    let strafe = getStrafeDir(dotToDodge);
                    let d = Calcs.timeToHitRect(dotToDodge.x, dotToDodge.y, dotToDodge.vx, dotToDodge.vy, 
                        newX, newY, newX2, newY2, strafe[0], strafe[1]);
                    if (d === false)
                        return true;
                    else 
                        return isUnavoidable(strafe, dotToDodge, d);
                })();
                if (!dodged) {
                    me.aimX = -dotToDodge.vx;
                    me.aimY = -dotToDodge.vy;
                    return;
                }
                //dotToDodge.dodgedBy = me;
            }

            dotToDodge = null;
            let lowestTime = null;
            let lowestDot = null;
            controller.grid.enumerateDots(function (dot) {
                if (dot.owner === me || dot.dodgedBy === me) return false;
                let strafe = getStrafeDir(dot);
                let d = Calcs.timeToHitRect(dot.x, dot.y, dot.vx, dot.vy, 
                    newX, newY, newX2, newY2, strafe[0], strafe[1]);
                if (d !== false) {
                    if (!isUnavoidable(strafe, dot, d)) {
                        if (lowestTime === null || lowestTime > d) {
                            lowestTime = d;
                            lowestDot = dot;
                        }
                    }
                }
                return false;
            });

            if (lowestTime !== null) {
                if (me.horizontal === 0)
                    me.horizontal = Math.random() < 0.5 ? -1 : 1;
                else 
                    me.horizontal *= -1;
                me.aimX = -lowestDot.vx;
                me.aimY = -lowestDot.vy;
                dotToDodge = lowestDot;
                vertical = 0;
            } else {
                let aim = Calcs.aimbot(target.x + target.radius, target.y + target.radius,
                    me.x + me.radius, me.y + me.radius, target.vx, target.vy, me.weapon.speed);
                let timeToHit = Calcs.magnitude(target.x - me.x, target.y - me.y) 
                    / me.weapon.speed;
                let p2 = Calcs.posOnReverse(
                    target.x, target.y, target.vx, target.vy,
                    target.movementAccelMag, target.maxSpeed, timeToHit, fps);
                p2[0] -= me.x;
                p2[1] -= me.y;
                let rand = Math.random();
                if (rand >= 0.32) 
                    rand = 1.0;
                me.aimX = rand * (aim.x - p2[0]) + p2[0];
                me.aimY = rand * (aim.y - p2[1]) + p2[1];
            }
        }
    };
};
*/
