package game;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.util.ArrayList;

public abstract class Figur {

    private boolean isWhite, active = false;
    private BufferedImage img;
    private ArrayList<Point> moves = new ArrayList<>();

    public Figur(boolean isWhite, BufferedImage img){

        this.isWhite = isWhite;
        this.img = img;
    }


    public boolean isWhite() {
        return isWhite;
    }

    public void setWhite(boolean white) {
        isWhite = white;
    }

    public BufferedImage getImg() {
        return img;
    }

    public void setImg(BufferedImage img) {
        this.img = img;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public ArrayList<Point> getMoves() {
        return moves;
    }

    public void setMoves(ArrayList<Point> moves) {
        this.moves = moves;
    }
}
