import { registerNode } from '@topology/core';
import { activityFinal, activityFinalIconRect, activityFinalTextRect } from './final';
import { fork, forkHAnchors, forkVAnchors, forkIconRect, forkTextRect } from './fork';
import { swimlaneH, swimlaneHIconRect, swimlaneHTextRect } from './swimlaneH';
import { swimlaneV, swimlaneVIconRect, swimlaneVTextRect } from './swimlaneV';

export function register() {
  registerNode('activityFinal', activityFinal, null, activityFinalIconRect, activityFinalTextRect);
  registerNode('swimlaneV', swimlaneV, null, swimlaneVIconRect, swimlaneVTextRect);
  registerNode('swimlaneH', swimlaneH, null, swimlaneHIconRect, swimlaneHTextRect);
  registerNode('forkH', fork, forkHAnchors, forkIconRect, forkTextRect);
  registerNode('forkV', fork, forkVAnchors, forkIconRect, forkTextRect);
}
