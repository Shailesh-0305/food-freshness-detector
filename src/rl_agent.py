import os
from stable_baselines3 import DQN
from rl_environment import FreshnessEnv

def train_rl_agent(models_dir="models", timesteps=10000):
    env = FreshnessEnv()
    
    # Lightweight DQN model
    model = DQN("MlpPolicy", env, verbose=1, learning_rate=1e-3, buffer_size=50000)
    
    print("Training RL agent...")
    model.learn(total_timesteps=timesteps)
    
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, "rl_policy")
    model.save(model_path)
    print(f"Agent saved to {model_path}.zip")

def load_rl_agent(model_path="models/rl_policy"):
    try:
        model = DQN.load(model_path)
        return model
    except Exception as e:
        print(f"Could not load RL agent: {e}")
        return None

if __name__ == "__main__":
    # Train the agent
    train_rl_agent(timesteps=20000)
    
    # Test
    model = load_rl_agent()
    if model:
        # Example state: Score 80, Conf 0.9, Days 2 (Expected action: 0 - Continue Storage)
        action, _ = model.predict([80.0, 0.9, 2.0], deterministic=True)
        print(f"Action for fresh food: {action}")
        
        # Example state: Score 50, Conf 0.8, Days 5 (Expected action: 1 - Consume Soon)
        action, _ = model.predict([50.0, 0.8, 5.0], deterministic=True)
        print(f"Action for deteriorating food: {action}")
        
        # Example state: Score 10, Conf 0.9, Days 10 (Expected action: 2 - Discard)
        action, _ = model.predict([10.0, 0.9, 10.0], deterministic=True)
        print(f"Action for spoiled food: {action}")
