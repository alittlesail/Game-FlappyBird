{
if (typeof FlappyBird === "undefined") window.FlappyBird = {};


FlappyBird.g_GConfig = undefined;
FlappyBird.GCenter = JavaScript.Class(undefined, {
	Ctor : function() {
		this._fly_a = 20;
		this._fly_power = 5;
		this._dieing = false;
		this._fly_y_rate = 0;
		this._dqn_range = 0;
	},
	Setup : function() {
		FlappyBird.g_GConfig = ALittle.CreateConfigSystem(FlappyBird.g_ModuleBasePath + "/User.cfg");
		ALittle.Math_RandomSeed(ALittle.Time_GetCurTime());
		ALittle.System_SetThreadCount(1);
		this._main_layer = ALittle.NewObject(ALittle.DisplayLayout, FlappyBird.g_Control);
		this._main_layer.width_type = 4;
		this._main_layer.height_type = 4;
		FlappyBird.g_LayerGroup.AddChild(this._main_layer, undefined);
		this._dialog_layer = ALittle.NewObject(ALittle.DisplayLayout, FlappyBird.g_Control);
		this._dialog_layer.width_type = 4;
		this._dialog_layer.height_type = 4;
		FlappyBird.g_LayerGroup.AddChild(this._dialog_layer, undefined);
		this._main_scene = FlappyBird.g_Control.CreateControl("main_scene", this, this._main_layer);
		this._main_scene.visible = false;
		this._main_menu = FlappyBird.g_Control.CreateControl("main_menu", this, undefined);
		this._dialog_layer.AddChild(this._main_menu, undefined);
		this._main_menu.visible = true;
		{
			let y_value = this._bird_image.y_value;
			let min_y_value = y_value - 10;
			let max_y_value = y_value + 10;
			this._bird_image_loop = ALittle.NewObject(ALittle.LoopList);
			this._bird_image_loop.AddUpdater(ALittle.NewObject(ALittle.LoopLinear, this._bird_image, "y_value", min_y_value, 1000, 0));
			let linear_list = ALittle.NewObject(ALittle.LoopList);
			linear_list.AddUpdater(ALittle.NewObject(ALittle.LoopLinear, this._bird_image, "y_value", max_y_value, 2000, 0));
			linear_list.AddUpdater(ALittle.NewObject(ALittle.LoopLinear, this._bird_image, "y_value", min_y_value, 2000, 0));
			linear_list._user_data = linear_list;
			this._bird_image_loop.AddUpdater(ALittle.NewObject(ALittle.LoopRepeat, linear_list, -1));
			this._bird_image_loop.Start();
		}
		this._game_over.visible = false;
		this._game_title.visible = true;
		this._max_score_text._user_data = FlappyBird.g_GConfig.GetConfig("max_score", 0);
		this._max_score_text.text = this._max_score_text._user_data;
		this._frame_anti = ALittle.NewObject(ALittle.LoopFrame, this.LoopGroundFrame.bind(this));
		if (deeplearning.DeeplearningDQNModel !== undefined) {
			let state_num = 3;
			let action_num = 2;
			this._dqn_model = ALittle.NewObject(deeplearning.DeeplearningDQNModel, state_num, action_num, 100, 2000);
			this._dqn_model_path = FlappyBird.g_ModuleBasePath + "/Other/flappybird_" + state_num + "_" + action_num + ".model";
			this._dqn_model.Load(this._dqn_model_path);
			this._tip_1.visible = false;
			this._tip_2.visible = false;
		}
	},
	Restart : function() {
		this._ground_frame_acc = 0;
		this._next_pipe_gap = 0;
		this._next_pipe_up = 50;
		this._bird.y = this._ground.y / 2;
		this._bird.x = this._bird.width;
		this._bird.angle = 0;
		this._bird.visible = true;
		this._bird.Play();
		this._game_over.visible = false;
		this._dieing = false;
		this._fly_y_rate = 0;
		this._score_text.text = "0";
		this._score_text._user_data = 0;
		this._pipe_container.RemoveAllChild();
		this._frame_anti.Start();
	},
	CalcState : function() {
		let [dst_x, start_y, end_y, total_y, center_y] = this.CalcRange();
		let state = [];
		state[1 - 1] = dst_x - this._bird.x;
		state[2 - 1] = center_y - this._bird.y;
		state[3 - 1] = this._fly_y_rate;
		return state;
	},
	CalcRange : function() {
		let dst_x = A_UISystem.view_width;
		let start_y = this._ground.y / 4;
		let end_y = this._ground.y / 4 * 3;
		let ___OBJECT_1 = this._pipe_container.childs;
		for (let i = 1; i <= ___OBJECT_1.length; ++i) {
			let child = ___OBJECT_1[i - 1];
			if (child === undefined) break;
			if (child.x + child.width >= this._bird.x - this._bird.width / 2) {
				dst_x = child.x + child.width + this._bird.width / 2;
				if (child._user_data === true) {
					start_y = child.y + child.height + this._bird.height / 2 + this._dqn_range;
					end_y = this._ground.y;
				} else {
					start_y = 0;
					end_y = child.y - this._bird.height / 2 - this._dqn_range;
				}
				break;
			}
		}
		let total_y = end_y - start_y;
		let center_y = total_y / 2 + start_y;
		return [dst_x, start_y, end_y, total_y, center_y];
	},
	CalcReward : function(die, change_pipe) {
		let src_x = this._bird.x;
		let src_y = this._bird.y;
		let [dst_x, start_y, end_y, total_y, center_y] = this.CalcRange();
		let reward = 0.0;
		{
			let max = 100;
			if (src_y > center_y) {
				let k = max / (center_y - end_y);
				let b = max;
				reward = reward + (k * (src_y - center_y) + b);
			} else {
				let k = max / (center_y - start_y);
				let b = max;
				reward = reward + (k * (src_y - center_y) + b);
			}
			if (reward > 0) {
				if (src_y > center_y) {
					if (this._fly_y_rate > 0) {
						reward = reward - (ALittle.Math_Abs(src_y - center_y) / total_y * 2 * ALittle.Math_Abs(this._fly_y_rate));
					} else {
						reward = reward + (ALittle.Math_Abs(src_y - center_y) / total_y * 2 * ALittle.Math_Abs(this._fly_y_rate));
					}
				}
				if (src_y < center_y) {
					if (this._fly_y_rate < 0) {
						reward = reward - (ALittle.Math_Abs(src_y - center_y) / total_y * 2 * ALittle.Math_Abs(this._fly_y_rate));
					} else {
						reward = reward + (ALittle.Math_Abs(src_y - center_y) / total_y * 2 * ALittle.Math_Abs(this._fly_y_rate));
					}
				}
			}
			this._reward_text.text = ALittle.Math_Floor(reward);
			this._reward_text.red = 0;
			if (reward < 20) {
				this._reward_text.red = 1;
			}
			this._reward_text.green = 0;
			this._reward_text.blue = 0;
			this._target_x_text.text = start_y;
			this._target_y_text.text = end_y;
		}
		return reward;
	},
	CalcPipe : function() {
		let ___OBJECT_2 = this._pipe_container.childs;
		for (let i = 1; i <= ___OBJECT_2.length; ++i) {
			let child = ___OBJECT_2[i - 1];
			if (child === undefined) break;
			if (child.x + child.width >= this._bird.x - this._bird.width / 2) {
				return child;
			}
		}
		return undefined;
	},
	LoopGroundFrame : function(frame_time) {
		this.LoopGroundFrameImpl(frame_time);
	},
	LoopGroundFrameImpl : function(frame_time) {
		let y_delta_time = frame_time / 1000;
		let x_delta_time = frame_time / 20;
		let old_dieing = this._dieing;
		let old_pipe = this.CalcPipe();
		let state = undefined;
		let action = 0;
		if (this._dqn_model !== undefined) {
			state = this.CalcState();
			if (ALittle.Math_RandomInt(1, 100) < 99) {
				action = this._dqn_model.ChooseAction(state);
			} else {
				action = ALittle.Math_RandomInt(0, 1);
			}
		}
		if (!this._dieing) {
			if (action !== 0) {
				this._fly_y_rate = -this._fly_power;
			}
			let cur_score = this._score_text._user_data + frame_time;
			this._score_text._user_data = cur_score;
			this._score_text.text = ALittle.Math_Floor(cur_score / 100);
		}
		let total_time = (this._ground.width - this._main_scene.width) * 20;
		this._ground_frame_acc = this._ground_frame_acc + (frame_time);
		if (this._ground_frame_acc > total_time) {
			this._ground_frame_acc = (this._ground_frame_acc % total_time);
		}
		this._ground.x = -this._ground_frame_acc / 20;
		if (this._bird.x < this._bg.width / 2) {
			this._bird.x = this._bird.x + x_delta_time;
		} else {
			let create_pipe = false;
			if (this._pipe_container.child_count === 0) {
				create_pipe = true;
			} else {
				let pipe = this._pipe_container.childs[this._pipe_container.child_count - 1];
				let right = pipe.x + pipe.width;
				if (this._bg.width - right > this._next_pipe_gap) {
					create_pipe = true;
				}
				pipe = this._pipe_container.childs[1 - 1];
				if (pipe.x + pipe.width < 0) {
					this._pipe_container.RemoveChild(pipe);
				}
			}
			if (create_pipe) {
				let pipe = FlappyBird.g_Control.CreateControl("pipe");
				this._pipe_container.AddChild(pipe);
				let total_height = this._bg.height - this._ground.height;
				let half_height = total_height / 2;
				if (ALittle.Math_RandomInt(1, 100) <= this._next_pipe_up) {
					let min_y = ALittle.Math_Floor(-pipe.height + pipe.height / 4);
					let max_y = ALittle.Math_Floor(half_height - pipe.height);
					pipe.y = ALittle.Math_RandomInt(min_y, max_y);
					pipe._user_data = true;
					this._next_pipe_up = 30;
				} else {
					let min_y = ALittle.Math_Floor(half_height);
					let max_y = ALittle.Math_Floor(total_height - pipe.height / 4);
					pipe.y = ALittle.Math_RandomInt(min_y, max_y);
					pipe._user_data = false;
					this._next_pipe_up = 70;
				}
				pipe.x = this._bg.width;
				this._next_pipe_gap = ALittle.Math_RandomInt(100, 150);
			}
			let ___OBJECT_3 = this._pipe_container.childs;
			for (let index = 1; index <= ___OBJECT_3.length; ++index) {
				let child = ___OBJECT_3[index - 1];
				if (child === undefined) break;
				child.x = child.x - x_delta_time;
			}
		}
		this._fly_y_rate = this._fly_y_rate + (this._fly_a * y_delta_time);
		this._bird.y = this._bird.y + (this._fly_y_rate);
		if (this._dieing === false) {
			if (this._fly_y_rate < 0) {
				let rate = 1.0;
				if (-this._fly_y_rate < this._fly_power) {
					rate = -this._fly_y_rate / this._fly_power;
				}
				this._bird.angle = -45 * rate;
			} else {
				let rate = 1.0;
				if (this._fly_y_rate < this._fly_power) {
					rate = this._fly_y_rate / this._fly_power;
				}
				this._bird.angle = 45 * rate;
			}
		}
		let new_pipe = this.CalcPipe();
		if (this._dieing) {
			if (this._bird.y + this._bird.height / 2 >= this._ground.y) {
				this.ShowGameOver();
			}
		} else {
			let ___OBJECT_4 = this._pipe_container.childs;
			for (let index = 1; index <= ___OBJECT_4.length; ++index) {
				let child = ___OBJECT_4[index - 1];
				if (child === undefined) break;
				let left = this._bird.x - this._bird.width / 2;
				let right = this._bird.x + this._bird.width / 2;
				let top = this._bird.y - this._bird.height / 2;
				let bottom = this._bird.y + this._bird.height / 2;
				if ((left > child.x && left <= child.x + child.width || right > child.x && right <= child.x + child.width) && (top > child.y && top <= child.y + child.height || bottom > child.y && bottom <= child.y + child.height)) {
					this._dieing = true;
					break;
				}
			}
			if (this._bird.y - this._bird.height / 2 <= 0 || this._bird.y + this._bird.height / 2 >= this._ground.y) {
				this._dieing = true;
			}
			if (this._dieing) {
				this._bird.angle = 90;
				this._bird.Stop();
				if (this._dqn_model !== undefined) {
					this.ShowGameOver();
					this.HandleStartClick(undefined);
				}
			}
			if (this._dqn_model !== undefined && (this._dieing === false || old_dieing === false)) {
				let reward = this.CalcReward(this._dieing, old_pipe !== new_pipe);
				let next_state = this.CalcState();
				this._dqn_model.SaveTransition(state, action, reward, next_state);
				for (let i = 1; i <= 32; i += 1) {
					this._dqn_model.Learn();
				}
			}
		}
	},
	HandleStartClick : function(event) {
		this._main_menu.visible = false;
		this._main_scene.visible = true;
		this.Restart();
	},
	HandleLButtonDown : function(event) {
		this._tip_1.visible = false;
		this._tip_2.visible = false;
		if (this._dqn_model === undefined && this._dieing === false) {
			this._fly_y_rate = -this._fly_power;
		}
	},
	HandleLButtonUp : function(event) {
	},
	ShowGameOver : function() {
		this._main_menu.visible = true;
		this._main_scene.visible = false;
		this._game_over.visible = true;
		this._game_title.visible = false;
		this._bird.Stop();
		this._frame_anti.Stop();
		let cur_socre = ALittle.Math_Floor(this._score_text._user_data / 100);
		if (this._max_score_text._user_data < cur_socre) {
			this._max_score_text._user_data = cur_socre;
			this._max_score_text.text = this._max_score_text._user_data;
			FlappyBird.g_GConfig.SetConfig("max_score", cur_socre, undefined);
		}
		if (this._dqn_model !== undefined) {
			this._dqn_model.Save(this._dqn_model_path);
			this.HandleStartClick(undefined);
		}
	},
	Shutdown : function() {
		this._bird.Stop();
		this._frame_anti.Stop();
		this._bird_image_loop.Stop();
		if (this._dqn_model !== undefined) {
			this._dqn_model.Save(this._dqn_model_path);
			this._dqn_model = undefined;
		}
	},
}, "FlappyBird.GCenter");

FlappyBird.g_GCenter = ALittle.NewObject(FlappyBird.GCenter);
}