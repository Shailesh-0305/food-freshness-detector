import gymnasium as gym
from gymnasium import spaces
import numpy as np

class FreshnessEnv(gym.Env):
    """
    Simulated Environment for Food Freshness Decision Making.
    """
    def __init__(self):
        super(FreshnessEnv, self).__init__()
        
        # Actions:
        # 0: Continue Storage
        # 1: Consume Soon
        # 2: Discard
        self.action_space = spaces.Discrete(3)
        
        # Observation space:
        # [Freshness Score (0-100), Confidence (0.0-1.0), Days Observed (0-30)]
        self.observation_space = spaces.Box(
            low=np.array([0, 0.0, 0]), 
            high=np.array([100, 1.0, 30]), 
            dtype=np.float32
        )
        
        self.state = None

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        # Initialize a random state for simulation
        score = np.random.uniform(0, 100)
        confidence = np.random.uniform(0.5, 1.0)
        days = np.random.randint(0, 10)
        
        self.state = np.array([score, confidence, days], dtype=np.float32)
        return self.state, {}

    def step(self, action):
        score, conf, days = self.state
        
        reward = 0
        
        # Simple reward logic
        if score >= 75:
            # Fresh
            if action == 0: # Continue storage
                reward = 1.0
            else:
                reward = -1.0
        elif 35 <= score < 75:
            # Deteriorating
            if action == 1: # Consume soon
                reward = 1.0
            else:
                reward = -1.0
        else:
            # Spoiled
            if action == 2: # Discard
                reward = 1.0
            elif action == 0:
                # Heavily penalize storing spoiled food
                reward = -2.0
            else:
                reward = -1.0
                
        # Low confidence penalty - agent should probably just consume or inspect
        if conf < 0.6 and action == 0:
            reward -= 0.5

        # Episode ends immediately after one decision in this simple context
        terminated = True
        truncated = False
        
        return self.state, reward, terminated, truncated, {}
