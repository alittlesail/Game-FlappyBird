-- ALittle Generate Lua And Do Not Edit This Line!
do
if _G.FlappyBird == nil then _G.FlappyBird = {} end
local FlappyBird = FlappyBird
local Lua = Lua
local ALittle = ALittle
local ___rawset = rawset
local ___pairs = pairs
local ___ipairs = ipairs


FlappyBird.g_GConfig = nil
FlappyBird.GCenter = Lua.Class(nil, "FlappyBird.GCenter")

function FlappyBird.GCenter:Ctor()
	___rawset(self, "_fly_a", 20)
	___rawset(self, "_fly_power", 5)
	___rawset(self, "_dieing", false)
	___rawset(self, "_fly_y_rate", 0)
	___rawset(self, "_dqn_range", 0)
end

function FlappyBird.GCenter:Setup()
	FlappyBird.g_GConfig = ALittle.CreateConfigSystem(FlappyBird.g_ModuleBasePath .. "/User.cfg")
	ALittle.Math_RandomSeed(ALittle.Time_GetCurTime())
	ALittle.System_SetThreadCount(1)
	self._main_layer = ALittle.DisplayLayout(FlappyBird.g_Control)
	self._main_layer.width_type = 4
	self._main_layer.height_type = 4
	FlappyBird.g_LayerGroup:AddChild(self._main_layer, nil)
	self._dialog_layer = ALittle.DisplayLayout(FlappyBird.g_Control)
	self._dialog_layer.width_type = 4
	self._dialog_layer.height_type = 4
	FlappyBird.g_LayerGroup:AddChild(self._dialog_layer, nil)
	self._main_scene = FlappyBird.g_Control:CreateControl("main_scene", self, self._main_layer)
	self._main_scene.visible = false
	self._main_menu = FlappyBird.g_Control:CreateControl("main_menu", self, nil)
	self._dialog_layer:AddChild(self._main_menu, nil)
	self._main_menu.visible = true
	do
		local y_value = self._bird_image.y_value
		local min_y_value = y_value - 10
		local max_y_value = y_value + 10
		self._bird_image_loop = ALittle.LoopList()
		self._bird_image_loop:AddUpdater(ALittle.LoopLinear(self._bird_image, "y_value", min_y_value, 1000, 0))
		local linear_list = ALittle.LoopList()
		linear_list:AddUpdater(ALittle.LoopLinear(self._bird_image, "y_value", max_y_value, 2000, 0))
		linear_list:AddUpdater(ALittle.LoopLinear(self._bird_image, "y_value", min_y_value, 2000, 0))
		linear_list._user_data = linear_list
		self._bird_image_loop:AddUpdater(ALittle.LoopRepeat(linear_list, -1))
		self._bird_image_loop:Start()
	end
	self._game_over.visible = false
	self._game_title.visible = true
	self._max_score_text._user_data = FlappyBird.g_GConfig:GetConfig("max_score", 0)
	self._max_score_text.text = self._max_score_text._user_data
	self._frame_anti = ALittle.LoopFrame(Lua.Bind(self.LoopGroundFrame, self))
	if ADeeplearning ~= nil and ADeeplearning.ARobotDqnDnnModel ~= nil then
		local state_num = 3
		local action_num = 2
		self._dqn_model = ADeeplearning.ARobotDqnDnnModel(state_num, action_num, 512, 1000)
		self._dqn_model:Load(FlappyBird.g_ModuleBasePath .. "/Other/flappybird_" .. state_num .. "_" .. action_num .. ".model")
		self._tip_1.visible = false
		self._tip_2.visible = false
	end
	self._reward_text.visible = self._dqn_model ~= nil
	self._target_x_text.visible = self._dqn_model ~= nil
	self._target_y_text.visible = self._dqn_model ~= nil
end

function FlappyBird.GCenter:Restart()
	self._ground_frame_acc = 0
	self._next_pipe_gap = 0
	self._next_pipe_up = 50
	self._bird.y = self._ground.y / 2
	self._bird.x = self._bird.width
	self._bird.angle = 0
	self._bird.visible = true
	self._bird:Play()
	self._game_over.visible = false
	self._dieing = false
	self._fly_y_rate = 0
	self._score_text.text = "0"
	self._score_text._user_data = 0
	self._pipe_container:RemoveAllChild()
	self._frame_anti:Start()
end

function FlappyBird.GCenter:CalcState()
	local dst_x, start_y, end_y, total_y, center_y = self:CalcRange()
	local state = {}
	state[1] = center_y
	state[2] = self._bird.y
	state[3] = self._fly_y_rate
	return state
end

function FlappyBird.GCenter:CalcRange()
	local dst_x = A_UISystem.view_width
	local start_y = self._ground.y / 4
	local end_y = self._ground.y / 4 * 3
	for i, child in ___ipairs(self._pipe_container.childs) do
		if child.x + child.width >= self._bird.x - self._bird.width / 2 then
			dst_x = child.x + child.width + self._bird.width / 2
			if child._user_data == true then
				start_y = child.y + child.height + self._bird.height / 2 + self._dqn_range
				end_y = self._ground.y
			else
				start_y = 0
				end_y = child.y - self._bird.height / 2 - self._dqn_range
			end
			break
		end
	end
	local total_y = end_y - start_y
	local center_y = total_y / 2 + start_y
	return dst_x, start_y, end_y, total_y, center_y
end

function FlappyBird.GCenter:CalcReward(die)
	local src_x = self._bird.x
	local src_y = self._bird.y
	local dst_x, start_y, end_y, total_y, center_y = self:CalcRange()
	local reward = 0.0
	do
		local max = 100
		if src_y > center_y then
			local k = max / (center_y - end_y)
			local b = max
			reward = reward + (k * (src_y - center_y) + b)
		else
			local k = max / (center_y - start_y)
			local b = max
			reward = reward + (k * (src_y - center_y) + b)
		end
		self._reward_text.text = ALittle.Math_Floor(reward)
		self._reward_text.red = 0
		if reward < 20 then
			self._reward_text.red = 1
		end
		self._reward_text.green = 0
		self._reward_text.blue = 0
		self._target_x_text.text = start_y
		self._target_y_text.text = end_y
	end
	return reward
end

function FlappyBird.GCenter:CalcPipe()
	for i, child in ___ipairs(self._pipe_container.childs) do
		if child.x + child.width >= self._bird.x - self._bird.width / 2 then
			return child
		end
	end
	return nil
end

function FlappyBird.GCenter:LoopGroundFrame(frame_time)
	local y_delta_time = frame_time / 1000
	local x_delta_time = frame_time / 20
	local old_dieing = self._dieing
	local old_pipe = self:CalcPipe()
	local state
	local action = 0
	if self._dqn_model ~= nil then
		state = self:CalcState()
		if ALittle.Math_RandomInt(1, 1000) < 10000 then
			action = self._dqn_model:ChooseAction(state)
		else
			action = ALittle.Math_RandomInt(0, 1)
		end
	end
	if not self._dieing then
		if action ~= 0 then
			self._fly_y_rate = -self._fly_power
		end
		local cur_score = self._score_text._user_data + frame_time
		self._score_text._user_data = cur_score
		self._score_text.text = ALittle.Math_Floor(cur_score / 100)
	end
	local total_time = (self._ground.width - self._main_scene.width) * 20
	self._ground_frame_acc = self._ground_frame_acc + (frame_time)
	if self._ground_frame_acc > total_time then
		self._ground_frame_acc = (self._ground_frame_acc % total_time)
	end
	self._ground.x = -self._ground_frame_acc / 20
	if self._bird.x < self._bg.width / 2 then
		self._bird.x = self._bird.x + x_delta_time
	else
		local create_pipe = false
		if self._pipe_container.child_count == 0 then
			create_pipe = true
		else
			local pipe = self._pipe_container.childs[self._pipe_container.child_count]
			local right = pipe.x + pipe.width
			if self._bg.width - right > self._next_pipe_gap then
				create_pipe = true
			end
			pipe = self._pipe_container.childs[1]
			if pipe.x + pipe.width < 0 then
				self._pipe_container:RemoveChild(pipe)
			end
		end
		if create_pipe then
			local pipe = FlappyBird.g_Control:CreateControl("pipe")
			self._pipe_container:AddChild(pipe)
			local total_height = self._bg.height - self._ground.height
			local half_height = total_height / 2
			if ALittle.Math_RandomInt(1, 100) <= self._next_pipe_up then
				local min_y = ALittle.Math_Floor(-pipe.height + pipe.height / 4)
				local max_y = ALittle.Math_Floor(half_height - pipe.height)
				pipe.y = ALittle.Math_RandomInt(min_y, max_y)
				pipe._user_data = true
				self._next_pipe_up = 30
			else
				local min_y = ALittle.Math_Floor(half_height)
				local max_y = ALittle.Math_Floor(total_height - pipe.height / 4)
				pipe.y = ALittle.Math_RandomInt(min_y, max_y)
				pipe._user_data = false
				self._next_pipe_up = 70
			end
			pipe.x = self._bg.width
			self._next_pipe_gap = ALittle.Math_RandomInt(100, 150)
		end
		for index, child in ___ipairs(self._pipe_container.childs) do
			child.x = child.x - x_delta_time
		end
	end
	self._fly_y_rate = self._fly_y_rate + (self._fly_a * y_delta_time)
	self._bird.y = self._bird.y + (self._fly_y_rate)
	if self._dieing == false then
		if self._fly_y_rate < 0 then
			local rate = 1.0
			if -self._fly_y_rate < self._fly_power then
				rate = -self._fly_y_rate / self._fly_power
			end
			self._bird.angle = -45 * rate
		else
			local rate = 1.0
			if self._fly_y_rate < self._fly_power then
				rate = self._fly_y_rate / self._fly_power
			end
			self._bird.angle = 45 * rate
		end
	end
	local new_pipe = self:CalcPipe()
	if self._dieing then
		if self._bird.y + self._bird.height / 2 >= self._ground.y then
			self:ShowGameOver()
		end
	else
		for index, child in ___ipairs(self._pipe_container.childs) do
			local left = self._bird.x - self._bird.width / 2
			local right = self._bird.x + self._bird.width / 2
			local top = self._bird.y - self._bird.height / 2
			local bottom = self._bird.y + self._bird.height / 2
			if (left > child.x and left <= child.x + child.width or right > child.x and right <= child.x + child.width) and (top > child.y and top <= child.y + child.height or bottom > child.y and bottom <= child.y + child.height) then
				self._dieing = true
				break
			end
		end
		if self._bird.y - self._bird.height / 2 <= 0 or self._bird.y + self._bird.height / 2 >= self._ground.y then
			self._dieing = true
		end
		if self._dieing then
			self._bird.angle = 90
			self._bird:Stop()
			if self._dqn_model ~= nil then
				self._dqn_model:Save()
				self:ShowGameOver()
				self:HandleStartClick(nil)
			end
		end
		if self._dqn_model ~= nil and (self._dieing == false or old_dieing == false) and old_pipe == new_pipe then
			local reward = self:CalcReward(self._dieing)
			local next_state = self:CalcState()
			if self._dqn_model:SaveTransition(state, next_state, action, reward) then
				self._dqn_model:Train(10)
			end
		end
	end
end

function FlappyBird.GCenter:HandleStartClick(event)
	self._main_menu.visible = false
	self._main_scene.visible = true
	self:Restart()
end

function FlappyBird.GCenter:HandleLButtonDown(event)
	self._tip_1.visible = false
	self._tip_2.visible = false
	if self._dqn_model == nil and self._dieing == false then
		self._fly_y_rate = -self._fly_power
	end
end

function FlappyBird.GCenter:HandleLButtonUp(event)
end

function FlappyBird.GCenter:ShowGameOver()
	self._main_menu.visible = true
	self._main_scene.visible = false
	self._game_over.visible = true
	self._game_title.visible = false
	self._bird:Stop()
	self._frame_anti:Stop()
	local cur_socre = ALittle.Math_Floor(self._score_text._user_data / 100)
	if self._max_score_text._user_data < cur_socre then
		self._max_score_text._user_data = cur_socre
		self._max_score_text.text = self._max_score_text._user_data
		FlappyBird.g_GConfig:SetConfig("max_score", cur_socre, nil)
	end
end

function FlappyBird.GCenter:Shutdown()
	self._bird:Stop()
	self._frame_anti:Stop()
	self._bird_image_loop:Stop()
	if self._dqn_model ~= nil then
		self._dqn_model:Save()
		self._dqn_model = nil
	end
end

FlappyBird.g_GCenter = FlappyBird.GCenter()
end