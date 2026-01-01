import { WindowMinimise, WindowToggleMaximise, Quit } from "../../wailsjs/runtime/runtime";
import { Minus, Square, X } from "lucide-react";
import "./WindowControls.css";

export function WindowControls() {
    return (
        <div className="window-controls">
            <button className="control-btn minimize" onClick={WindowMinimise} title="Minimize">
                <Minus size={12} />
            </button>
            <button className="control-btn maximize" onClick={WindowToggleMaximise} title="Maximize">
                <Square size={10} />
            </button>
            <button className="control-btn close" onClick={Quit} title="Close">
                <X size={12} />
            </button>
        </div>
    );
}
