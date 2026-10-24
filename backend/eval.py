from app.classifier import evaluate
if __name__=="__main__":
    for k,v in evaluate().items(): print(f"{k}: {v:.4f}" if isinstance(v,float) else f"{k}: {v}")
