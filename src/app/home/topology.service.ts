import { Injectable } from '@angular/core';
import { registerNode } from 'topology-core/middles';
import {
    flowData,
    flowDataAnchors,
    flowDataIconRect,
    flowDataTextRect,
    flowSubprocess,
    flowSubprocessIconRect,
    flowSubprocessTextRect,
    flowDb,
    flowDbIconRect,
    flowDbTextRect,
    flowDocument,
    flowDocumentAnchors,
    flowDocumentIconRect,
    flowDocumentTextRect,
    flowInternalStorage,
    flowInternalStorageIconRect,
    flowInternalStorageTextRect,
    flowExternStorage,
    flowExternStorageAnchors,
    flowExternStorageIconRect,
    flowExternStorageTextRect,
    flowQueue,
    flowQueueIconRect,
    flowQueueTextRect,
    flowManually,
    flowManuallyAnchors,
    flowManuallyIconRect,
    flowManuallyTextRect,
    flowDisplay,
    flowDisplayAnchors,
    flowDisplayIconRect,
    flowDisplayTextRect,
    flowParallel,
    flowParallelAnchors,
    flowComment,
    flowCommentAnchors
} from 'topology-flow-diagram';

import {
    activityFinal,
    activityFinalIconRect,
    activityFinalTextRect,
    swimlaneV,
    swimlaneVIconRect,
    swimlaneVTextRect,
    swimlaneH,
    swimlaneHIconRect,
    swimlaneHTextRect,
    fork,
    forkHAnchors,
    forkIconRect,
    forkTextRect,
    forkVAnchors
} from 'topology-activity-diagram';
import {
    simpleClass,
    simpleClassIconRect,
    simpleClassTextRect,
    interfaceClass,
    interfaceClassIconRect,
    interfaceClassTextRect
} from 'topology-class-diagram';
import {
    lifeline,
    lifelineAnchors,
    lifelineIconRect,
    lifelineTextRect,
    sequenceFocus,
    sequenceFocusAnchors,
    sequenceFocusIconRect,
    sequenceFocusTextRect
} from 'topology-sequence-diagram';


@Injectable()
export class TopologyService {

    constructor() { }

    canvasRegister() {
        registerNode('flowData', flowData, flowDataAnchors, flowDataIconRect, flowDataTextRect);
        registerNode('flowSubprocess', flowSubprocess, null, flowSubprocessIconRect, flowSubprocessTextRect);
        registerNode('flowDb', flowDb, null, flowDbIconRect, flowDbTextRect);
        registerNode('flowDocument', flowDocument, flowDocumentAnchors, flowDocumentIconRect, flowDocumentTextRect);
        registerNode(
            'flowInternalStorage',
            flowInternalStorage,
            null,
            flowInternalStorageIconRect,
            flowInternalStorageTextRect
        );
        registerNode(
            'flowExternStorage',
            flowExternStorage,
            flowExternStorageAnchors,
            flowExternStorageIconRect,
            flowExternStorageTextRect
        );
        registerNode('flowQueue', flowQueue, null, flowQueueIconRect, flowQueueTextRect);
        registerNode('flowManually', flowManually, flowManuallyAnchors, flowManuallyIconRect, flowManuallyTextRect);
        registerNode('flowDisplay', flowDisplay, flowDisplayAnchors, flowDisplayIconRect, flowDisplayTextRect);
        registerNode('flowParallel', flowParallel, flowParallelAnchors, null, null);
        registerNode('flowComment', flowComment, flowCommentAnchors, null, null);

        // activity
        registerNode('activityFinal', activityFinal, null, activityFinalIconRect, activityFinalTextRect);
        registerNode('swimlaneV', swimlaneV, null, swimlaneVIconRect, swimlaneVTextRect);
        registerNode('swimlaneH', swimlaneH, null, swimlaneHIconRect, swimlaneHTextRect);
        registerNode('forkH', fork, forkHAnchors, forkIconRect, forkTextRect);
        registerNode('forkV', fork, forkVAnchors, forkIconRect, forkTextRect);

        // class
        registerNode('simpleClass', simpleClass, null, simpleClassIconRect, simpleClassTextRect);
        registerNode('interfaceClass', interfaceClass, null, interfaceClassIconRect, interfaceClassTextRect);

        // sequence
        registerNode('lifeline', lifeline, lifelineAnchors, lifelineIconRect, lifelineTextRect);
        registerNode('sequenceFocus', sequenceFocus, sequenceFocusAnchors, sequenceFocusIconRect, sequenceFocusTextRect);
    }
}
