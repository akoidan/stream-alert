import {CommandContextExtn} from "telegraf/typings/telegram-types";
import {FrameData} from "@/native/native-model";

interface FrameDetector {
  onNewFrame(frameData: FrameData): Promise<void>;
}


interface TgCommandsExecutor {
  onAskImage(): Promise<void>;

  onSetThreshold(a: CommandContextExtn): Promise<void>;
  onIncreaseThreshold(): Promise<void>;
  onDecreaseThreshold(): Promise<void>;
}

interface GlobalService extends FrameDetector, TgCommandsExecutor {
}

export type {TgCommandsExecutor, FrameDetector, GlobalService}